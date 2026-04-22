import express, {} from "express";
import { ingestFaqUrls } from "../services/scraper/ingest.js";
export const adminIngestRouter = express.Router();
adminIngestRouter.post("/reingest-faq", async (req, res) => {
    try {
        const defaultUrls = ["https://sudarshansudarshan.github.io/vinternship/faq/"];
        const urls = req.body.urls && Array.isArray(req.body.urls) ? req.body.urls : defaultUrls;
        console.log("Admin triggered FAQ reingestion with URLs:", urls);
        // Doing this synchronously might time out the request if scraping takes too long.
        // For small dataset (14 FAQs), it will be fine.
        const result = await ingestFaqUrls(urls);
        res.json(result);
    }
    catch (error) {
        console.error("Reingest Failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
//# sourceMappingURL=adminIngest.js.map