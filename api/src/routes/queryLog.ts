import express, { type Request, type Response } from "express";
import { connectDB } from "../db.js";

export const queryLogRouter = express.Router();

// POST /query-log — insert a log entry
queryLogRouter.post("/", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("query_logs");

    const entry = {
      question: req.body.question ?? "",
      correctedQuestion: req.body.correctedQuestion ?? "",
      sourceType: req.body.sourceType ?? "LLM_FALLBACK",
      confidenceScore: req.body.confidenceScore ?? 0,
      matchedQuestion: req.body.matchedQuestion ?? null,
      responseTimeMs: req.body.responseTimeMs ?? 0,
      userId: req.body.userId ?? null,
      conversationId: req.body.conversationId ?? null,
      messageId: req.body.messageId ?? null,
      feedbackStatus: "neutral", // neutral | positive | negative
      timestamp: new Date(),
    };

    const result = await col.insertOne(entry);
    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error("[QueryLog] Insert failed:", err);
    res.status(500).json({ error: "Failed to log query" });
  }
});

// PATCH /query-log/:id/attach-message
queryLogRouter.patch("/:id/attach-message", async (req: Request, res: Response) => {
  try {
    const { ObjectId } = await import("mongodb");
    const db = await connectDB();
    const col = db.collection("query_logs");

    const { messageId } = req.body;
    if (!messageId) {
      return res.status(400).json({ error: "messageId required" });
    }

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { messageId } },
      { returnDocument: "after" }
    );

    if (!result) return res.status(404).json({ error: "Log not found" });
    res.json({ success: true, messageId });
  } catch (err) {
    console.error("[QueryLog] attach-message failed:", err);
    res.status(500).json({ error: "Failed to attach messageId" });
  }
});

// PATCH /query-log/:id/feedback — update feedbackStatus
queryLogRouter.patch("/:id/feedback", async (req: Request, res: Response) => {
  try {
    const { ObjectId } = await import("mongodb");
    const db = await connectDB();
    const col = db.collection("query_logs");

    const { feedbackStatus } = req.body; // neutral | positive | negative
    if (!["neutral", "positive", "negative"].includes(feedbackStatus)) {
      return res.status(400).json({ error: "Invalid feedbackStatus" });
    }

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { feedbackStatus } },
      { returnDocument: "after" }
    );

    if (!result) return res.status(404).json({ error: "Log not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

// GET /query-log — paginated list with optional filters and user info
queryLogRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("query_logs");

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.sourceType) filter.sourceType = req.query.sourceType;
    if (req.query.feedbackStatus) filter.feedbackStatus = req.query.feedbackStatus;
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from as string);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to as string);
    }

    const pipeline: any[] = [
      { $match: filter },
      { $sort: { timestamp: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          question: 1,
          correctedQuestion: 1,
          sourceType: 1,
          confidenceScore: 1,
          matchedQuestion: 1,
          responseTimeMs: 1,
          userId: 1,
          conversationId: 1,
          messageId: 1,
          feedbackStatus: 1,
          timestamp: 1,
          userName: 1,
          userEmail: "$userInfo.email"
        }
      }
    ];

    const [docs, total] = await Promise.all([
      col.aggregate(pipeline).toArray(),
      col.countDocuments(filter),
    ]);

    // Mask emails: admin@test.com -> ad***@test.com
    const data = docs.map(d => {
      const email = d.userEmail;
      if (email && email.includes("@")) {
        const [user, domain] = email.split("@");
        d.maskedEmail = user.length > 2 
          ? user.substring(0, 2) + "***" + "@" + domain 
          : user + "***" + "@" + domain;
      } else {
        d.maskedEmail = "anonymous";
      }
      delete d.userEmail;
      return d;
    });

    res.json({ total, page, limit, data });
  } catch (err) {
    console.error("[QueryLog] Fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch query logs" });
  }
});

// GET /query-log/repeated — queries asked 3+ times without a good answer
queryLogRouter.get("/repeated", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("query_logs");

    const pipeline = [
      { $match: { sourceType: "LLM_FALLBACK" } },
      {
        $group: {
          _id: "$correctedQuestion",
          count: { $sum: 1 },
          lastAsked: { $max: "$timestamp" },
          sample: { $first: "$question" },
        },
      },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ];

    const result = await col.aggregate(pipeline).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch repeated queries" });
  }
});
