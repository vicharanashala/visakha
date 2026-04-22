import express, { type Request, type Response } from "express";
import { connectDB } from "../db.js";
import { generateEmbedding } from "../services/scraper/embedder.js";
import { normalizeQuery } from "../services/search/queryNormalizer.js";
import Fuse from "fuse.js";

export const ragRouter = express.Router();

/**
 * Asynchronous query logger. Returns the queryLogId so it can be 
 * relayed to LibreChat to map the LLM's message_id back to this log.
 */
async function logQuery(params: {
  question: string;
  correctedQuestion: string;
  sourceType: string;
  confidenceScore: number;
  matchedQuestion: string | null;
  responseTimeMs: number;
  userId?: string | null;
  userName?: string | null;
  conversationId?: string | null;
  retrievalSource?: string | null;
  renderedBy?: string | null;
}): Promise<string | null> {
  try {
    const db = await connectDB();
    const result = await db.collection("query_logs").insertOne({
      ...params,
      messageId: null,
      feedbackStatus: "neutral",
      timestamp: new Date()
    });
    return result.insertedId.toString();
  } catch (err) {
    console.error("[RAG] Failed to log query:", err);
    return null;
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += (vecA[i] || 0) * (vecB[i] || 0);
    normA += (vecA[i] || 0) * (vecA[i] || 0);
    normB += (vecB[i] || 0) * (vecB[i] || 0);
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateTokenOverlap(queryTokens: string[], targetStr: string): number {
  if (!targetStr || queryTokens.length === 0) return 0;
  const targetTokens = targetStr.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
  let overlapCount = 0;
  for (const token of queryTokens) {
    if (targetTokens.includes(token)) overlapCount++;
  }
  return overlapCount / queryTokens.length;
}

ragRouter.post("/search", async (req: Request, res: Response) => {
  try {
    const question = req.body.question;
    if (!question || typeof question !== "string") {
       return res.status(400).json({ error: "Missing or invalid 'question' in body" });
    }

    // STEP 1: normalize + spell correct query
    const startTime = Date.now();
    const normalizedQuery = normalizeQuery(question);
    const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    const originalQueryFormatted = question.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
    const isTypoCorrected = normalizedQuery !== originalQueryFormatted;
    const isShortQuery = queryTokens.length < 4;

    console.log(`[RAG] Original Query: ${question}`);
    console.log(`[RAG] Corrected Query: ${normalizedQuery}`);

    const db = await connectDB();
    const faqCollection = db.collection("faq_chunks");
    const goldenCol = db.collection("golden_answers");

    // Use corrected query embedding for retrieval
    const questionVector = await generateEmbedding(normalizedQuery);
    
    // STEP 2: FAQ_DB vector search with Hybrid Ranking
    const allFAQChunks = await faqCollection.find({ sourceType: "FAQ_DB" }).toArray();
    let bestFaqResult = null;
    let maxFaqFinal = 0;
    let maxFaqEmbedding = 0;
    let topFaqOverlap = 0;
    let faqThreshold = 0.78;

    if (allFAQChunks && allFAQChunks.length > 0) {
      const faqFuse = new Fuse(allFAQChunks, {
        includeScore: true,
        keys: ["question", "title", "content"],
        threshold: 1.0
      });
      const faqFuseResults = faqFuse.search(normalizedQuery);
      const faqFuseScoreMap = new Map();
      for (const result of faqFuseResults) {
        faqFuseScoreMap.set(result.item._id.toString(), 1 - (result.score ?? 1));
      }

      for (const doc of allFAQChunks) {
        const dbDoc = doc as any;
        const semScore = dbDoc.embedding ? cosineSimilarity(questionVector, dbDoc.embedding as number[]) : 0;
        const fuzzyScore = faqFuseScoreMap.get(dbDoc._id.toString()) || 0;
        const targetStr = [dbDoc.question, dbDoc.title, dbDoc.content].join(" ");
        const overlap = calculateTokenOverlap(queryTokens, targetStr);
        
        const finalScore = (0.70 * semScore) + (0.20 * overlap) + (0.10 * fuzzyScore);

        if (finalScore > maxFaqFinal) {
          maxFaqFinal = finalScore;
          maxFaqEmbedding = semScore;
          topFaqOverlap = overlap;
          bestFaqResult = dbDoc;
        }
      }

      // Dynamic FAQ Thresholding
      if (queryTokens.length > 6) {
        faqThreshold = 0.55;
      }
      const intentWords = ["internship", "pace", "learning", "duration", "apply", "eligibility", "sessions", "bootcamp", "program", "mern"];
      if (queryTokens.some(t => intentWords.includes(t))) {
        faqThreshold = 0.52;
      }
      if (topFaqOverlap > 0.45) {
        faqThreshold = Math.min(faqThreshold, 0.50);
      }

      if (maxFaqFinal >= faqThreshold && bestFaqResult !== null) {
        console.log(`[FAQ EMBEDDING]: ${maxFaqEmbedding}`);
        console.log(`[FAQ FINAL]: ${maxFaqFinal}`);
        console.log(`[FAQ THRESHOLD]: ${faqThreshold}`);
        console.log(`[GOLDEN FINAL]: N/A`);
        console.log(`[GOLDEN THRESHOLD]: N/A`);
        console.log(`[RESULT]: FAQ_DB`);
        
        const { embedding, hash, ...rest } = bestFaqResult;
        const payload = {
          sourceType: "FAQ_DB",
          confidenceScore: maxFaqFinal,
          retrievalSource: "Official FAQ",
          originalQuery: question,
          normalizedQuery: normalizedQuery,
          ragMatchedQuestion: bestFaqResult.question || bestFaqResult.title,
          results: [rest]
        };
        const queryLogId = await logQuery({
          question,
          correctedQuestion: normalizedQuery,
          sourceType: "FAQ_DB",
          confidenceScore: maxFaqFinal,
          matchedQuestion: bestFaqResult.question || null,
          responseTimeMs: Date.now() - startTime,
          userId: req.body.userId ?? null,
          userName: req.body.userName ?? null,
          conversationId: req.body.conversationId ?? null,
          retrievalSource: "Official FAQ",
          renderedBy: req.body.renderedBy ?? "gemini-2.5-flash",
        });
        
        return res.json({ ...payload, queryLogId });
      }
    }

    // STEP 3: GOLDEN_DB retrieval
    const allGolden = await goldenCol.find({ status: "approved" }).toArray();
    let bestGoldenScore = 0;
    let bestGoldenResult = null;
    let goldenThreshold = 0.65;

    // Golden dynamic threshold
    if (isShortQuery) {
        goldenThreshold = 0.40;
    } else if (isTypoCorrected) {
        goldenThreshold = 0.45;
    }

    const goldenKeywordBoosts = ["stipend", "certificate", "deadline", "fee", "selection", "platform", "duration"];
    const needsGoldenBoost = queryTokens.some(t => goldenKeywordBoosts.includes(t));

    if (allGolden && allGolden.length > 0) {
      const goldenFuse = new Fuse(allGolden, {
        includeScore: true,
        keys: ["question", "normalizedQuestion"],
        threshold: 1.0
      });
      const goldenFuseResults = goldenFuse.search(normalizedQuery);
      const goldenFuseScoreMap = new Map();
      for (const result of goldenFuseResults) {
        goldenFuseScoreMap.set(result.item._id.toString(), 1 - (result.score ?? 1));
      }

      for (const doc of allGolden) {
        const dbDoc = doc as any;
        const semScore = dbDoc.embedding ? cosineSimilarity(questionVector, dbDoc.embedding as number[]) : 0;
        const fuzzyScore = goldenFuseScoreMap.get(dbDoc._id.toString()) || 0;
        const targetText = dbDoc.normalizedQuestion || dbDoc.question;
        const overlap = calculateTokenOverlap(queryTokens, targetText);
        
        let finalScore = (0.60 * semScore) + (0.30 * fuzzyScore) + (0.10 * overlap);
        
        if (needsGoldenBoost) {
            finalScore += 0.08;
        }
        
        if (finalScore > bestGoldenScore) {
          bestGoldenScore = finalScore;
          bestGoldenResult = dbDoc;
        }
      }
      
      if (bestGoldenScore >= goldenThreshold && bestGoldenResult !== null) {
        console.log(`[FAQ EMBEDDING]: ${maxFaqEmbedding}`);
        console.log(`[FAQ FINAL]: ${maxFaqFinal}`);
        console.log(`[FAQ THRESHOLD]: ${faqThreshold}`);
        console.log(`[GOLDEN FINAL]: ${bestGoldenScore}`);
        console.log(`[GOLDEN THRESHOLD]: ${goldenThreshold}`);
        console.log(`[RESULT]: GOLDEN_DB`);

        const { _id, embedding, ...rest } = bestGoldenResult;
        const goldenPayload = {
          sourceType: "GOLDEN_DB",
          confidenceScore: bestGoldenScore,
          retrievalSource: "Approved Answer",
          originalQuery: question,
          normalizedQuery: normalizedQuery,
          ragMatchedQuestion: bestGoldenResult.question,
          results: [{ ...rest, content: bestGoldenResult.answer }]
        };
        const queryLogId = await logQuery({
          question,
          correctedQuestion: normalizedQuery,
          sourceType: "GOLDEN_DB",
          confidenceScore: bestGoldenScore,
          matchedQuestion: bestGoldenResult.question || null,
          responseTimeMs: Date.now() - startTime,
          userId: req.body.userId ?? null,
          userName: req.body.userName ?? null,
          conversationId: req.body.conversationId ?? null,
          retrievalSource: "Approved Answer",
          renderedBy: req.body.renderedBy ?? "gemini-2.5-flash",
        });

        return res.json({ ...goldenPayload, queryLogId });
      }
    }

    // STEP 4: Gemini fallback
    console.log(`[FAQ EMBEDDING]: ${maxFaqEmbedding}`);
    console.log(`[FAQ FINAL]: ${maxFaqFinal}`);
    console.log(`[FAQ THRESHOLD]: ${faqThreshold}`);
    console.log(`[GOLDEN FINAL]: ${bestGoldenScore}`);
    console.log(`[GOLDEN THRESHOLD]: ${goldenThreshold}`);
    console.log(`[RESULT]: GEMINI`);

    const geminiPayload = {
      sourceType: "LLM_FALLBACK",
      confidenceScore: Math.max(maxFaqFinal, bestGoldenScore, 0),
      retrievalSource: "Gemini",
      originalQuery: question,
      normalizedQuery: normalizedQuery,
      ragMatchedQuestion: null,
      message: "No strong matches found in local knowledge bases."
    };
    const queryLogId = await logQuery({
      question,
      correctedQuestion: normalizedQuery,
      sourceType: "LLM_FALLBACK",
      confidenceScore: Math.max(maxFaqFinal, bestGoldenScore, 0),
      matchedQuestion: null,
      responseTimeMs: Date.now() - startTime,
      userId: req.body.userId ?? null,
      userName: req.body.userName ?? null,
      conversationId: req.body.conversationId ?? null,
      retrievalSource: "Gemini",
      renderedBy: req.body.renderedBy ?? "gemini-2.5-flash",
    });

    return res.json({ ...geminiPayload, queryLogId });

  } catch (error) {
    console.error("RAG Search failed:", error);
    res.status(500).json({ error: "Internal server error during search" });
  }
});
