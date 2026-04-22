import express, {} from "express";
import { connectDB } from "../db.js";
import { generateEmbedding } from "../services/scraper/embedder.js";
import { findStrongFaqMatch } from "../services/search/fuzzyFaqSearch.js";
import { normalizeQuery } from "../services/search/queryNormalizer.js";
export const ragRouter = express.Router();
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += (vecA[i] || 0) * (vecB[i] || 0);
        normA += (vecA[i] || 0) * (vecA[i] || 0);
        normB += (vecB[i] || 0) * (vecB[i] || 0);
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
ragRouter.post("/search", async (req, res) => {
    try {
        const question = req.body.question;
        if (!question || typeof question !== "string") {
            return res.status(400).json({ error: "Missing or invalid 'question' in body" });
        }
        const normalizedQuery = normalizeQuery(question);
        console.log(`[RAG] Original Query:\n${question}\n`);
        console.log(`[RAG] Corrected Query:\n${normalizedQuery}\n`);
        const db = await connectDB();
        const faqCollection = db.collection("faq_chunks");
        const goldenCol = db.collection("golden_answers");
        const allFAQChunks = await faqCollection.find({ sourceType: "FAQ_DB" }).toArray();
        // PHASE 0: Typo-Tolerant FAQ Search
        if (allFAQChunks && allFAQChunks.length > 0) {
            const fuzzyMatchResult = findStrongFaqMatch(normalizedQuery, allFAQChunks);
            if (fuzzyMatchResult) {
                console.log(`[RAG] FAQ Match Found`);
                const { embedding, hash, ...rest } = fuzzyMatchResult.match;
                return res.json({
                    sourceType: "FAQ_DB",
                    confidenceScore: fuzzyMatchResult.score,
                    retrievalSource: "Official FAQ",
                    originalQuery: question,
                    normalizedQuery: normalizedQuery,
                    ragMatchedQuestion: rest.question,
                    results: [rest]
                });
            }
        }
        // 1. Embed the search question
        const questionVector = await generateEmbedding(question);
        // PHASE 1: FAQ_DB Semantic Search
        let faqScore = 0;
        if (allFAQChunks && allFAQChunks.length > 0) {
            const scoredFAQ = allFAQChunks.map(chunk => {
                const dbDoc = chunk;
                const score = cosineSimilarity(questionVector, dbDoc.embedding);
                return { ...dbDoc, score };
            });
            scoredFAQ.sort((a, b) => b.score - a.score);
            const topFAQ = scoredFAQ.slice(0, 3);
            if (topFAQ.length > 0 && topFAQ[0].score >= 0.60) {
                // Strong FAQ Match
                console.log(`[RAG] FAQ_DB Hit`);
                const results = topFAQ.map(match => {
                    const { embedding, hash, ...rest } = match;
                    return rest;
                });
                return res.json({
                    sourceType: "FAQ_DB",
                    confidenceScore: topFAQ[0].score,
                    retrievalSource: "Official FAQ",
                    originalQuery: question,
                    normalizedQuery: normalizedQuery,
                    ragMatchedQuestion: results[0].question,
                    results
                });
            }
            else if (topFAQ.length > 0) {
                faqScore = topFAQ[0].score;
            }
        }
        // PHASE 2: GOLDEN_DB Search (Only if FAQ < 0.60)
        console.log(`[PIPELINE] FAQ weak/no hit (score=${faqScore}). Checking GOLDEN_DB...`);
        // A. Exact normalized question match first
        const exactGolden = await goldenCol.findOne({
            normalizedQuestion: normalizedQuery,
            status: "approved"
        });
        if (exactGolden) {
            console.log(`[RAG] GOLDEN_DB Hit`);
            const { _id, ...rest } = exactGolden;
            return res.json({
                sourceType: "GOLDEN_DB",
                confidenceScore: 1.0, // perfect exact match
                retrievalSource: "Approved Answer",
                originalQuery: question,
                normalizedQuery: normalizedQuery,
                ragMatchedQuestion: exactGolden.question,
                results: [{ ...rest, content: exactGolden.answer }] // standardized structure
            });
        }
        // B. Semantic matching for GOLDEN_DB
        const allGolden = await goldenCol.find({ status: "approved" }).toArray();
        if (allGolden && allGolden.length > 0) {
            const scoredGolden = allGolden.map(doc => {
                const dbDoc = doc;
                // fallback to 0 if no embedding yet
                const score = dbDoc.embedding ? cosineSimilarity(questionVector, dbDoc.embedding) : 0;
                return { ...dbDoc, score };
            }).filter(d => d.score > 0);
            scoredGolden.sort((a, b) => b.score - a.score);
            if (scoredGolden.length > 0 && scoredGolden[0].score >= 0.60) {
                console.log(`[RAG] GOLDEN_DB Hit`);
                const { _id, embedding, ...rest } = scoredGolden[0];
                return res.json({
                    sourceType: "GOLDEN_DB",
                    confidenceScore: scoredGolden[0].score,
                    retrievalSource: "Approved Answer",
                    originalQuery: question,
                    normalizedQuery: normalizedQuery,
                    ragMatchedQuestion: scoredGolden[0].question,
                    results: [{ ...rest, content: scoredGolden[0].answer }]
                });
            }
        }
        // PHASE 3: FALLBACK TO LLM
        console.log(`[RAG] Gemini Fallback`);
        return res.json({
            sourceType: "LLM_FALLBACK",
            confidenceScore: Math.max(faqScore, 0),
            retrievalSource: "Gemini",
            originalQuery: question,
            normalizedQuery: normalizedQuery,
            ragMatchedQuestion: null,
            message: "No strong matches found in local knowledge bases."
        });
    }
    catch (error) {
        console.error("RAG Search failed:", error);
        res.status(500).json({ error: "Internal server error during search" });
    }
});
//# sourceMappingURL=rag.js.map