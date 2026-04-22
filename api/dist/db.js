import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/visakha_local";
const dbName = process.env.DB_NAME || "visakha_local";
const client = new MongoClient(uri);
let db;
export async function connectDB() {
    if (!db) {
        console.log(`🔌 Connecting to MongoDB: ${uri} / ${dbName}`);
        await client.connect();
        db = client.db(dbName);
        console.log("✅ MongoDB connected to:", db.databaseName);
    }
    return db;
}
//# sourceMappingURL=db.js.map