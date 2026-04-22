import crypto from "crypto";
import { scrapeFaqPages } from "./faqScraper.js";
import { preprocessAndChunk } from "./preprocess.js";
import { generateEmbeddingsBatch } from "./embedder.js";
import { connectDB } from "../../db.js";
function computeHash(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
}
export async function ingestFaqUrls(urls) {
    console.log("--- Starting FAQ Ingestion Pipeline ---");
    // Phase 1: Scrape
    console.log("Phase 1: Scraping URLs...");
    const rawData = await scrapeFaqPages(urls);
    console.log(`Scraped ${rawData.length} unique FAQ items.`);
    if (rawData.length === 0) {
        console.log("No data scrapped. Aborting.");
        return { success: false, pagesScraped: urls.length, chunksStored: 0 };
    }
    // Phase 2 & 3: Preprocess & Chunk
    console.log("Phase 2 & 3: Preprocessing and chunking...");
    const chunks = preprocessAndChunk(rawData);
    console.log(`Generated ${chunks.length} chunks.`);
    // Phase 4: Embeddings
    console.log("Phase 4: Generating embeddings...");
    const textsToEmbed = chunks.map(c => `Question: ${c.question}\nAnswer: ${c.content}`);
    const embeddings = await generateEmbeddingsBatch(textsToEmbed);
    // Prepare final documents
    const now = new Date();
    const documents = chunks.map((chunk, idx) => ({
        title: chunk.title,
        question: chunk.question,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        sourceUrl: chunk.sourceUrl,
        sourceType: "FAQ_DB",
        sourceName: "Internship FAQ",
        embedding: embeddings[idx],
        confidenceBoost: 1.0,
        hash: computeHash(chunk.content),
        createdAt: now,
        lastUpdatedAt: now
    }));
    // Phase 5: DB Storage
    console.log("Phase 5: Storing in MongoDB...");
    try {
        const db = await connectDB();
        const collection = db.collection("faq_chunks");
        // Option: Delete all previous records of this type before inserting, 
        // since the dataset is small and we want to refresh cleanly.
        await collection.deleteMany({ sourceType: "FAQ_DB", sourceName: "Internship FAQ" });
        // Batch insert
        if (documents.length > 0) {
            await collection.insertMany(documents);
            // Ensure basic indexes are present for standard querying
            await collection.createIndex({ hash: 1 }, { unique: true });
            await collection.createIndex({ sourceUrl: 1 });
        }
        console.log(`Completed. Stored ${documents.length} chunks into faq_chunks collection.`);
        return {
            success: true,
            pagesScraped: urls.length,
            chunksStored: documents.length
        };
    }
    catch (error) {
        console.error("DB Storage failed:", error);
        throw error;
    }
}
//# sourceMappingURL=ingest.js.map