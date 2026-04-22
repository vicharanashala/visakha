import express, {} from "express";
export const pendingReviewsRouter = express.Router();
pendingReviewsRouter.get("/", (req, res) => {
    res.json({ status: "not_implemented", message: "Pending reviews endpoint" });
});
//# sourceMappingURL=pendingReviews.js.map