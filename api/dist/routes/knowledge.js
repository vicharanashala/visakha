import express, {} from "express";
export const knowledgeRouter = express.Router();
knowledgeRouter.get("/faq", (req, res) => {
    res.json({ status: "not_implemented", message: "FAQ retrieval endpoint" });
});
//# sourceMappingURL=knowledge.js.map