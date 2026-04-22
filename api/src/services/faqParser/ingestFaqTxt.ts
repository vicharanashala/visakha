import { parseFaqTxt } from "./faqParser.js";
import { generateEmbeddingsBatch } from "../scraper/embedder.js";
import { connectDB } from "../../db.js";

export interface IngestFaqResult {
  success: boolean;
  topicsDetected: number;
  questionsStored: number;
  deletedOld: number;
  error?: string;
}

export async function ingestFaqTxt(filePath?: string): Promise<IngestFaqResult> {
  console.log("--- Starting FAQ TXT Ingestion Pipeline ---");

  // ── Step 1: Parse ──────────────────────────────────────────────────────────
  const items = parseFaqTxt(filePath);
  const topicsDetected = new Set(items.map((i) => i.topicNo)).size;

  console.log(`[Parser] Detected ${topicsDetected} topics, ${items.length} questions.`);

  if (items.length === 0) {
    return { success: false, topicsDetected: 0, questionsStored: 0, deletedOld: 0, error: "Parser returned 0 items" };
  }

  // ── Step 2: Embed ─────────────────────────────────────────────────────────
  console.log(`[Embedder] Generating embeddings for ${items.length} items...`);
  const textsToEmbed = items.map((i) => i.content);
  const embeddings = await generateEmbeddingsBatch(textsToEmbed);
  console.log(`[Embedder] Done.`);

  // ── Step 3: Build documents ───────────────────────────────────────────────
  const now = new Date();
  const documents = items.map((item, idx) => ({
    displayIndex: item.displayIndex,
    sortKey: item.sortKey,
    topicNo: item.topicNo,
    topicName: item.topicName,
    question: item.question,
    answer: item.answer,
    content: item.content,
    sourceType: "FAQ_DB" as const,
    sourceName: "Internship FAQ",
    embedding: embeddings[idx],
    createdAt: now,
    lastUpdatedAt: now,
  }));

  // ── Step 4: Store ─────────────────────────────────────────────────────────
  const db = await connectDB();
  const col = db.collection("faq_chunks");

  // Delete ALL old FAQ_DB records unconditionally
  const deleteResult = await col.deleteMany({ sourceType: "FAQ_DB" });
  const deletedOld = deleteResult.deletedCount ?? 0;
  console.log(`[DB] Deleted ${deletedOld} old faq_chunks.`);

  // Drop the legacy unique `hash_1` index from the old scraper pipeline.
  // New documents don't have a hash field, so this would cause E11000 errors.
  try {
    await col.dropIndex("hash_1");
    console.log(`[DB] Dropped legacy hash_1 index.`);
  } catch {
    // Index doesn't exist — that's fine, just continue.
  }

  // Insert fresh sorted documents
  await col.insertMany(documents, { ordered: true });
  console.log(`[DB] Inserted ${documents.length} faq_chunks.`);

  // Ensure useful indexes for the RAG search path
  await col.createIndex({ sourceType: 1 });
  await col.createIndex({ sortKey: 1 });
  await col.createIndex({ topicNo: 1 });

  console.log("--- FAQ TXT Ingestion Complete ---");

  return {
    success: true,
    topicsDetected,
    questionsStored: documents.length,
    deletedOld,
  };
}
