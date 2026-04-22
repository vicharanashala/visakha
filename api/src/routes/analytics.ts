import express, { type Request, type Response } from "express";
import { connectDB } from "../db.js";
import { ObjectId } from "mongodb";

export const analyticsRouter = express.Router();

/**
 * GET /analytics/summary
 * Core KPIs: Queries, Users, DAU, Hit Rates, Latency
 */
analyticsRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const queryCol = db.collection("query_logs");
    const userCol = db.collection("users");

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalQueries,
      totalUsers,
      dau,
      sourceCounts,
      feedbackCounts,
      avgResponse
    ] = await Promise.all([
      queryCol.countDocuments(),
      userCol.countDocuments(),
      queryCol.distinct("userId", { timestamp: { $gte: yesterday } }).then(ids => ids.length),
      queryCol.aggregate([{ $group: { _id: "$sourceType", count: { $sum: 1 } } }]).toArray(),
      queryCol.aggregate([{ $group: { _id: "$feedbackStatus", count: { $sum: 1 } } }]).toArray(),
      queryCol.aggregate([{ $group: { _id: null, avg: { $avg: "$responseTimeMs" } } }]).toArray(),
    ]);

    const sources = sourceCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {} as Record<string, number>);
    const feedbacks = feedbackCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {} as Record<string, number>);

    const faqHits = sources["FAQ_DB"] || 0;
    const goldenHits = sources["GOLDEN_DB"] || 0;
    const llmFallbacks = sources["LLM_FALLBACK"] || 0;
    const totalRated = (feedbacks["positive"] || 0) + (feedbacks["negative"] || 0);

    res.json({
      totalQueries,
      totalUsers,
      dau,
      faqHits,
      goldenHits,
      llmFallbacks,
      faqHitRate: totalQueries ? Math.round((faqHits / totalQueries) * 100) : 0,
      goldenHitRate: totalQueries ? Math.round((goldenHits / totalQueries) * 100) : 0,
      llmFallbackRate: totalQueries ? Math.round((llmFallbacks / totalQueries) * 100) : 0,
      negativeFeedbackRate: totalRated > 0 ? Math.round(((feedbacks["negative"] || 0) / totalRated) * 100) : 0,
      avgResponseTimeMs: avgResponse[0]?.avg ? Math.round(avgResponse[0].avg) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load summary" });
  }
});

/**
 * GET /analytics/top-questions
 */
analyticsRouter.get("/top-questions", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const top = await db.collection("query_logs").aggregate([
      {
        $group: {
          _id: "$correctedQuestion",
          count: { $sum: 1 },
          sourceType: { $last: "$sourceType" },
          avgConfidence: { $avg: "$confidenceScore" },
          sample: { $first: "$question" },
          lastAsked: { $max: "$timestamp" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]).toArray();

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: "Failed to load top questions" });
  }
});

/**
 * GET /analytics/source-breakdown
 */
analyticsRouter.get("/source-breakdown", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const breakdown = await db.collection("query_logs").aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            source: "$sourceType"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": 1 } }
    ]).toArray();

    const chartDataMap: Record<string, any> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      chartDataMap[dateStr] = { date: dateStr, FAQ_DB: 0, GOLDEN_DB: 0, LLM_FALLBACK: 0 };
    }

    breakdown.forEach(b => {
      const d = b._id.date;
      const s = b._id.source;
      if (chartDataMap[d]) {
        chartDataMap[d][s] = b.count;
      }
    });

    res.json(Object.values(chartDataMap));
  } catch (err) {
    res.status(500).json({ error: "Failed to load source breakdown" });
  }
});

/**
 * GET /analytics/negative-feedback
 */
analyticsRouter.get("/negative-feedback", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const negs = await db.collection("query_logs").aggregate([
      { $match: { feedbackStatus: "negative" } },
      {
        $group: {
          _id: "$correctedQuestion",
          count: { $sum: 1 },
          sample: { $first: "$question" },
          sourceType: { $last: "$sourceType" },
          lastAsked: { $max: "$timestamp" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]).toArray();

    res.json(negs);
  } catch (err) {
    res.status(500).json({ error: "Failed to load negative feedback" });
  }
});
