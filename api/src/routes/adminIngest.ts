import express, { type Request, type Response } from "express";
import { ingestFaqTxt } from "../services/faqParser/ingestFaqTxt.js";

export const adminIngestRouter = express.Router();

/**
 * POST /admin/reingest-faq
 * Triggers full FAQ re-ingestion from the local faq.txt file.
 * Deletes all old FAQ_DB chunks and inserts fresh parsed Q&A pairs.
 */
adminIngestRouter.post("/reingest-faq", async (req: Request, res: Response) => {
  try {
    console.log("[Admin] FAQ re-ingestion triggered from faq.txt");
    const result = await ingestFaqTxt();
    res.json(result);
  } catch (error) {
    console.error("[Admin] Reingest failed:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
