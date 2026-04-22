import express, { type Request, type Response } from "express";
import { connectDB } from "../db.js";
import { ObjectId } from "mongodb";

export const feedbackRouter = express.Router();

const GOLDEN_DB_NEGATIVE_COUNT_THRESHOLD = 3;   // ≥3 individual negative votes
const GOLDEN_DB_NEGATIVE_RATIO_THRESHOLD = 0.5; // AND ≥50% of all feedback is negative

/**
 * POST /feedback
 * Smart source-aware feedback routing:
 *   FAQ_DB    → analytics only (no queue)
 *   GOLDEN_DB → analytics + flag if count+ratio threshold met
 *   LLM_FALLBACK (👍) → review_queue as "potential_golden"
 *   LLM_FALLBACK (👎) → review_queue as "needs_correction"
 */
feedbackRouter.post("/", async (req: Request, res: Response) => {
  try {
    const {
      question,
      correctedQuestion,
      sourceType,
      confidenceScore,
      rating,
      generatedAnswer,
      userId,
      conversationId,
      message_id,
      query_log_id,
      retrievalSource,
    } = req.body;

    // --- Validation ---
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question is required" });
    }
    if (rating !== "up" && rating !== "down") {
      return res.status(400).json({ error: "rating must be 'up' or 'down'" });
    }

    // --- Strict rating mapping (fixes inversion bug) ---
    const feedbackStatus: "positive" | "negative" = rating === "up" ? "positive" : "negative";

    const db = await connectDB();
    const feedbackCol = db.collection("feedback_events");
    const logCol = db.collection("query_logs");

    // --- Enforce uniqueness: one feedback per user per message ---
    if (userId && message_id) {
      const existing = await feedbackCol.findOne({ user_id: userId, message_id });
      if (existing) {
        return res.status(400).json({ error: "Feedback already submitted for this message" });
      }
    }

    // --- Update query_log feedbackStatus ---
    if (query_log_id) {
      try {
        await logCol.updateOne(
          { _id: new ObjectId(query_log_id) },
          { $set: { feedbackStatus, messageId: message_id ?? null } }
        );
      } catch (_) {
        // Non-fatal — log may not exist yet if messageId patch is delayed
      }
    } else if (message_id) {
      // Fallback: find by messageId
      await logCol.updateOne(
        { messageId: message_id, feedbackStatus: "neutral" },
        { $set: { feedbackStatus } }
      );
    }

    // --- Source-aware routing ---
    const src = sourceType ?? "UNKNOWN";

    if (src === "LLM_FALLBACK") {
      // Both thumbs route to review_queue with different reviewType
      const reviewType = feedbackStatus === "positive" ? "potential_golden" : "needs_correction";
      const reviewCol = db.collection("review_queue");

      const normQ = (correctedQuestion ?? question).toLowerCase().trim().replace(/[^\w\s]/g, "");
      const basePriority = feedbackStatus === "positive" ? 50 : 80;
      const priorityIncrement = feedbackStatus === "positive" ? 5 : 10;

      await reviewCol.updateOne(
        { correctedQuestion: normQ, status: "pending", reviewType },
        [
          {
            $set: {
              question: question,
              badAnswer: generatedAnswer ?? "",
              sourceType: src,
              retrievalSource: retrievalSource ?? null,
              reviewType: reviewType,
              updatedAt: "$$NOW",
              createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
              user_id: { $ifNull: ["$user_id", userId ?? null] },
              query_log_id: { $ifNull: ["$query_log_id", query_log_id ?? null] },
              status: { $ifNull: ["$status", "pending"] },
              correctedQuestion: { $ifNull: ["$correctedQuestion", normQ] },
              occurrences: { $add: [{ $ifNull: ["$occurrences", 0] }, 1] },
              priorityScore: {
                $add: [
                  { $ifNull: ["$priorityScore", basePriority - priorityIncrement] },
                  priorityIncrement,
                ],
              },
              resolvedBy: { $ifNull: ["$resolvedBy", null] },
              resolvedAt: { $ifNull: ["$resolvedAt", null] },
              notes: { $ifNull: ["$notes", null] },
              isDuplicate: { $ifNull: ["$isDuplicate", false] },
              duplicateOf: { $ifNull: ["$duplicateOf", null] },
            },
          },
        ],
        { upsert: true }
      );

    } else if (src === "GOLDEN_DB" && feedbackStatus === "negative") {
      // Check count + ratio threshold before flagging
      const totalFeedback = await feedbackCol.countDocuments({
        correctedQuestion: correctedQuestion ?? question,
        sourceType: "GOLDEN_DB",
      });
      const negativeFeedback = await feedbackCol.countDocuments({
        correctedQuestion: correctedQuestion ?? question,
        sourceType: "GOLDEN_DB",
        feedbackType: "negative",
      });
      const negativeRatio = totalFeedback > 0 ? (negativeFeedback + 1) / (totalFeedback + 1) : 1;

      if (
        negativeFeedback + 1 >= GOLDEN_DB_NEGATIVE_COUNT_THRESHOLD &&
        negativeRatio >= GOLDEN_DB_NEGATIVE_RATIO_THRESHOLD
      ) {
        const reviewCol = db.collection("review_queue");
        const normQ = (correctedQuestion ?? question).toLowerCase().trim().replace(/[^\w\s]/g, "");

        await reviewCol.updateOne(
          { correctedQuestion: normQ, status: "pending", reviewType: "golden_degraded" },
          [
            {
              $set: {
                question: question,
                badAnswer: generatedAnswer ?? "",
                sourceType: src,
                reviewType: "golden_degraded",
                negativeRatio: Math.round(negativeRatio * 100) / 100,
                updatedAt: "$$NOW",
                createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
                user_id: { $ifNull: ["$user_id", userId ?? null] },
                query_log_id: { $ifNull: ["$query_log_id", query_log_id ?? null] },
                status: { $ifNull: ["$status", "pending"] },
                correctedQuestion: { $ifNull: ["$correctedQuestion", normQ] },
                occurrences: { $add: [{ $ifNull: ["$occurrences", 0] }, 1] },
                priorityScore: { $ifNull: ["$priorityScore", 90] },
                resolvedBy: { $ifNull: ["$resolvedBy", null] },
                resolvedAt: { $ifNull: ["$resolvedAt", null] },
                notes: { $ifNull: ["$notes", null] },
                isDuplicate: { $ifNull: ["$isDuplicate", false] },
                duplicateOf: { $ifNull: ["$duplicateOf", null] },
              },
            },
          ],
          { upsert: true }
        );
      }
      // else: analytics only (falls through to feedback_events write below)

    }
    // FAQ_DB: analytics only — no queue insertion

    // --- Always write to feedback_events (audit trail) ---
    await feedbackCol.insertOne({
      user_id: userId ?? null,
      message_id: message_id ?? null,
      query_log_id: query_log_id ?? null,
      feedbackType: feedbackStatus,  // "positive" | "negative" — CORRECT mapping
      rating,                        // raw value from client: "up" | "down"
      question,
      correctedQuestion: correctedQuestion ?? question,
      sourceType: src,
      retrievalSource: retrievalSource ?? null,
      confidenceScore: confidenceScore ?? 0,
      generatedAnswer: generatedAnswer ?? "",
      conversationId: conversationId ?? null,
      createdAt: new Date(),
    });

    console.log(`[Feedback] user=${userId ?? "anon"} rating=${rating} feedbackStatus=${feedbackStatus} source=${src}`);

    res.json({ success: true, feedbackStatus });
  } catch (err) {
    console.error("[Feedback] Error:", err);
    res.status(500).json({ error: "Failed to process feedback" });
  }
});

// GET /feedback — list recent feedback events (admin use)
feedbackRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const col = db.collection("feedback_events");

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;
    const feedbackType = req.query.feedbackType as string | undefined;

    const filter: Record<string, any> = {};
    if (feedbackType) filter.feedbackType = feedbackType;

    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    res.json({ total, page, limit, data: docs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});
