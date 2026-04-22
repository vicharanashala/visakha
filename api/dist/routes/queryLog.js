import express, {} from "express";
export const queryLogRouter = express.Router();
queryLogRouter.post("/", (req, res) => {
    res.json({ status: "not_implemented", message: "Query log endpoint" });
});
//# sourceMappingURL=queryLog.js.map