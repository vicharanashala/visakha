import express, { type Request, type Response } from "express";
import { connectDB } from "../db.js";
import { ObjectId } from "mongodb";
import { generateEmbedding } from "../services/scraper/embedder.js";

export const reviewQueueRouter = express.Router();

/**
 * GET /review-queue
 * Paginated list sorted by priorityScore desc.
 * Filters: status, reviewType, sourceType
 */
reviewQueueRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("review_queue");

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.reviewType) filter.reviewType = req.query.reviewType;
    if (req.query.sourceType) filter.sourceType = req.query.sourceType;

    const [docs, total] = await Promise.all([
      col.find(filter).sort({ priorityScore: -1, occurrences: -1, createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    res.json({ total, page, limit, data: docs });
  } catch (err) {
    console.error("[ReviewQueue] List failed:", err);
    res.status(500).json({ error: "Failed to fetch review queue" });
  }
});

/**
 * PATCH /review-queue/:id
 * Update status, notes, isDuplicate, duplicateOf
 * Valid statuses: pending | resolved | dismissed | duplicate
 */
reviewQueueRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("review_queue");

    const { status, notes, isDuplicate, duplicateOf, resolvedBy } = req.body;

    const validStatuses = ["pending", "resolved", "dismissed", "duplicate"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const updateFields: Record<string, any> = { updatedAt: new Date() };
    if (status) {
      updateFields.status = status;
      if (status !== "pending") {
        updateFields.resolvedAt = new Date();
        updateFields.resolvedBy = resolvedBy ?? "admin";
      }
    }
    if (notes !== undefined) updateFields.notes = notes;
    if (isDuplicate !== undefined) updateFields.isDuplicate = isDuplicate;
    if (duplicateOf !== undefined) updateFields.duplicateOf = duplicateOf;

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) return res.status(404).json({ error: "Review item not found" });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[ReviewQueue] Patch failed:", err);
    res.status(500).json({ error: "Failed to update review item" });
  }
});

/**
 * POST /review-queue/:id/promote
 * Promotes a review item to GOLDEN_DB:
 * 1. Accepts optional edited answer in body
 * 2. Generates embedding for the question
 * 3. Inserts into golden_answers with promotion metadata
 * 4. Marks the review item as resolved
 */
reviewQueueRouter.post("/:id/promote", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const reviewCol = db.collection("review_queue");
    const goldenCol = db.collection("golden_answers");

    const reviewItem = await reviewCol.findOne({ _id: new ObjectId(req.params.id) });
    if (!reviewItem) return res.status(404).json({ error: "Review item not found" });
    if (reviewItem.status !== "pending") {
      return res.status(400).json({ error: `Cannot promote item with status: ${reviewItem.status}` });
    }

    const { answer, editedAnswer, tags, promotedBy = "admin" } = req.body;
    const finalAnswer = editedAnswer ?? answer ?? reviewItem.badAnswer ?? "";

    if (!finalAnswer || finalAnswer.trim() === "") {
      return res.status(400).json({ error: "answer is required for promotion" });
    }

    const question = reviewItem.question;
    const normalizedQuestion = question.toLowerCase().trim().replace(/[^\w\s]/g, "");

    // Generate embedding
    const embedding = await generateEmbedding(question);

    // Insert into golden_answers with promotion metadata
    const goldenDoc = {
      question,
      normalizedQuestion,
      answer: finalAnswer,
      tags: tags ?? [],
      embedding,
      status: "approved",
      // Promotion metadata (refinement #3)
      promotedFrom: "review_queue",
      promotedFromId: reviewItem._id.toString(),
      promotedBy,
      promotedAt: new Date(),
      originalSourceType: reviewItem.sourceType,
      originalReviewType: reviewItem.reviewType,
      occurrences: reviewItem.occurrences,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const goldenResult = await goldenCol.insertOne(goldenDoc);

    // Mark review item as resolved
    await reviewCol.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status: "resolved",
          resolvedBy: promotedBy,
          resolvedAt: new Date(),
          notes: `Promoted to GOLDEN_DB as ${goldenResult.insertedId}`,
          promotedGoldenId: goldenResult.insertedId.toString(),
        }
      }
    );

    res.status(201).json({
      success: true,
      goldenId: goldenResult.insertedId,
      message: `"${question.substring(0, 50)}..." promoted to GOLDEN_DB`,
    });
  } catch (err) {
    console.error("[ReviewQueue] Promote failed:", err);
    res.status(500).json({ error: "Failed to promote to GOLDEN_DB" });
  }
});

/**
 * GET /review-queue/stats
 * Summary counts by status and reviewType
 */
reviewQueueRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("review_queue");

    const [byStatus, byType] = await Promise.all([
      col.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
      col.aggregate([
        { $match: { status: "pending" } },
        { $group: { _id: "$reviewType", count: { $sum: 1 }, avgPriority: { $avg: "$priorityScore" } } },
      ]).toArray(),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) statusMap[s._id] = s.count;

    res.json({
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      pending: statusMap["pending"] ?? 0,
      resolved: statusMap["resolved"] ?? 0,
      dismissed: statusMap["dismissed"] ?? 0,
      duplicate: statusMap["duplicate"] ?? 0,
      byType,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch review queue stats" });
  }
});
