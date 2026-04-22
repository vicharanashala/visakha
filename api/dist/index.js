import express, {} from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "./db.js";
import { feedbackConversationsRouter } from "./routes/feedbackConversations.js";
import { analyticsRouter } from "./routes/analytics.js";
import { pendingReviewsRouter } from "./routes/pendingReviews.js";
import { knowledgeRouter } from "./routes/knowledge.js";
import { queryLogRouter } from "./routes/queryLog.js";
import { adminIngestRouter } from "./routes/adminIngest.js";
import { ragRouter } from "./routes/rag.js";
const app = express();
// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
// Simple API-key auth middleware for write/admin routes
export function requireAdminKey(req, res, next) {
    const key = req.headers["x-admin-key"];
    const expected = process.env.ADMIN_API_KEY || "visakha-local-admin-secret-2024";
    if (!key || key !== expected) {
        return res.status(401).json({ error: "Unauthorized: invalid or missing X-Admin-Key header" });
    }
    next();
}
// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "visakha-api", timestamp: new Date().toISOString() });
});
// ── Routes ────────────────────────────────────────────────────────────────────
// Legacy HTML viewer (keep all existing behaviour)
app.use("/", feedbackConversationsRouter);
// New JSON REST APIs
app.use("/analytics", analyticsRouter);
app.use("/pending-reviews", pendingReviewsRouter);
app.use("/knowledge", knowledgeRouter);
app.use("/query-log", queryLogRouter);
app.use("/api/admin", requireAdminKey, adminIngestRouter);
app.use("/api/rag", ragRouter);
// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3090;
app.listen(PORT, "0.0.0.0", async () => {
    try {
        await connectDB();
        console.log(`✅ MongoDB connected`);
    }
    catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
    }
    console.log(`🚀 Visakha API running at http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map