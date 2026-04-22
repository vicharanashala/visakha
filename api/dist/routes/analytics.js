import express, {} from "express";
export const analyticsRouter = express.Router();
analyticsRouter.get("/summary", (req, res) => {
    res.json({ status: "not_implemented", message: "Analytics summary endpoint" });
});
//# sourceMappingURL=analytics.js.map