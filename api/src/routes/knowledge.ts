import express, { type Request, type Response } from "express";
import { connectDB } from "../db.js";
import { generateEmbedding } from "../services/scraper/embedder.js";
import { ObjectId } from "mongodb";

export const knowledgeRouter = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// FAQ CHUNKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /knowledge/faq
 * Paginated list of faq_chunks sorted naturally by sortKey.
 */
knowledgeRouter.get("/faq", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("faq_chunks");

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;

    const filter: Record<string, any> = { sourceType: "FAQ_DB" };
    if (search) filter.$text = { $search: search };

    const projection = { embedding: 0 };

    const [docs, total] = await Promise.all([
      col
        .find(filter, { projection })
        .sort({ sortKey: 1 })            // natural numeric order: 1.1, 1.2 … 14.7
        .skip(skip)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ]);

    res.json({ total, page, limit, data: docs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch FAQ chunks" });
  }
});

/**
 * GET /knowledge/faq/topics
 * Returns all FAQ chunks grouped by topic — used by the admin dashboard.
 * No pagination: returns the full grouped structure in one shot.
 */
knowledgeRouter.get("/faq/topics", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("faq_chunks");

    // Fetch all FAQ docs sorted by sortKey, excluding large embedding field
    const docs = await col
      .find({ sourceType: "FAQ_DB" }, { projection: { embedding: 0 } })
      .sort({ sortKey: 1 })
      .toArray();

    // Group by topicNo → topicName
    const topicMap = new Map<
      number,
      { topicNo: number; topicName: string; questions: any[] }
    >();

    for (const doc of docs) {
      const d = doc as any;
      const tNo: number = d.topicNo ?? 0;
      if (!topicMap.has(tNo)) {
        topicMap.set(tNo, {
          topicNo: tNo,
          topicName: d.topicName ?? `Topic ${tNo}`,
          questions: [],
        });
      }
      topicMap.get(tNo)!.questions.push({
        _id: d._id,
        displayIndex: d.displayIndex,
        sortKey: d.sortKey,
        question: d.question,
        answer: d.answer,
      });
    }

    // Convert map to array sorted by topicNo
    const topics = Array.from(topicMap.values()).sort(
      (a, b) => a.topicNo - b.topicNo
    );

    res.json({ total: docs.length, topics });
  } catch (err) {
    console.error("[Knowledge] faq/topics failed:", err);
    res.status(500).json({ error: "Failed to fetch FAQ topics" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN ANSWERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /knowledge/golden — list golden answers
knowledgeRouter.get("/golden", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("golden_answers");

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || "approved";

    const filter: Record<string, any> = { status };

    const [docs, total] = await Promise.all([
      col
        .find(filter, { projection: { embedding: 0 } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ]);

    res.json({ total, page, limit, data: docs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch golden answers" });
  }
});

// GET /knowledge/golden-suggestions — list user-submitted suggestions
knowledgeRouter.get("/golden-suggestions", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("golden_suggestions");

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      col.find({ status: "pending" }).sort({ occurrences: -1, createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments({ status: "pending" }),
    ]);

    res.json({ total, page, limit, data: docs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch golden suggestions" });
  }
});

// PATCH /knowledge/golden-suggestions/:id — update suggestion status
knowledgeRouter.patch("/golden-suggestions/:id", async (req: Request, res: Response) => {
  try {
    const { ObjectId } = await import("mongodb");
    const { status } = req.body;
    if (!["pending", "resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const db = await connectDB();
    const col = db.collection("golden_suggestions");

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) return res.status(404).json({ error: "Suggestion not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update suggestion" });
  }
});

// POST /knowledge/golden — create + embed
knowledgeRouter.post("/golden", async (req: Request, res: Response) => {
  try {
    const { question, answer, tags } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: "question and answer are required" });
    }

    const db = await connectDB();
    const col = db.collection("golden_answers");

    const normalizedQuestion = question.toLowerCase().trim().replace(/[^\w\s]/g, "");
    const embedding = await generateEmbedding(question);

    const doc = {
      question,
      normalizedQuestion,
      answer,
      tags: tags ?? [],
      embedding,
      status: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await col.insertOne(doc);
    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error("[Knowledge] Create golden failed:", err);
    res.status(500).json({ error: "Failed to create golden answer" });
  }
});

// PUT /knowledge/golden/:id — update + re-embed
knowledgeRouter.put("/golden/:id", async (req: Request, res: Response) => {
  try {
    const { question, answer, tags, status } = req.body;
    const db = await connectDB();
    const col = db.collection("golden_answers");

    const updateFields: Record<string, any> = { updatedAt: new Date() };
    if (answer) updateFields.answer = answer;
    if (tags) updateFields.tags = tags;
    if (status) updateFields.status = status;

    if (question) {
      updateFields.question = question;
      updateFields.normalizedQuestion = question.toLowerCase().trim().replace(/[^\w\s]/g, "");
      updateFields.embedding = await generateEmbedding(question);
    }

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields },
      { returnDocument: "after", projection: { embedding: 0 } }
    );

    if (!result) return res.status(404).json({ error: "Golden answer not found" });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to update golden answer" });
  }
});

// DELETE /knowledge/golden/:id — soft-delete
knowledgeRouter.delete("/golden/:id", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("golden_answers");

    await col.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: "archived", updatedAt: new Date() } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive golden answer" });
  }
});
