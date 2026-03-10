import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/visakha";
const dbName = process.env.DB_NAME || "test";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);

        console.log("Checking latest User messages...");
        const latest = await db.collection('messages').find({ sender: "User" }).sort({ createdAt: -1 }).limit(5).toArray();
        console.log("Latest User messages:", JSON.stringify(latest, null, 2));

        const range = '24h';
        let matchStage = { sender: "User" };
        let dateLimit = new Date();
        dateLimit.setHours(dateLimit.getHours() - 24);
        matchStage.createdAt = { $gte: dateLimit };
        let format = "%Y-%m-%dT%H:00:00";

        console.log("Date boundary (24h):", dateLimit.toISOString());

        const stats = await db.collection("messages").aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: format, date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log("Aggregation results:", JSON.stringify(stats, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
