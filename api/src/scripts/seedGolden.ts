import { connectDB } from "../db.js";
import { generateEmbedding } from "../services/scraper/embedder.js";

const seedGolden = async () => {
  try {
    const db = await connectDB();
    const collection = db.collection("golden_answers");

    const record = {
      question: "What is stipend?",
      normalizedQuestion: "what is stipend",
      answer: "A stipend is a fixed regular sum of money paid to interns during their internship period to cover basic expenses. In Vi-Sakha internships, the exact amount depends on the specific project and duration.",
      sourceType: "GOLDEN_DB",
      status: "approved",
      approvedBy: "admin",
      approvedAt: new Date(),
      tags: ["finance", "internship"],
      createdAt: new Date(),
      updatedAt: new Date(),
      embedding: await generateEmbedding("What is stipend?")
    };

    // Upsert based on normalizedQuestion
    await collection.updateOne(
      { normalizedQuestion: record.normalizedQuestion },
      { $set: record },
      { upsert: true }
    );

    console.log("✅ Seeded GOLDEN_DB successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedGolden();
