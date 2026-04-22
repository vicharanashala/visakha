import { MongoClient, type Db } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/visakha_local";
const dbName = process.env.DB_NAME || "visakha_local";
const client = new MongoClient(uri);

let db: Db;

export async function connectDB(): Promise<Db> {
  if (!db) {
    console.log(`🔌 Connecting to MongoDB: ${uri} / ${dbName}`);
    await client.connect();
    db = client.db(dbName);

    // Initialize required indexes for Phase-2
    try {
      await db.collection("feedback_events").createIndex(
        { user_id: 1, message_id: 1 },
        { unique: true, partialFilterExpression: { user_id: { $type: "string" }, message_id: { $type: "string" } } }
      );
    } catch (e) {
      console.error("Failed to create feedback index:", e);
    }

    console.log("✅ MongoDB connected to:", db.databaseName);
  }
  return db;
}
