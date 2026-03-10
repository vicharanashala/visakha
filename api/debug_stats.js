const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: 'e:/INTERNSHIP/visakha/api/.env' });

async function check() {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/visakha";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || "test");

        const now = new Date();
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - 30);

        console.log("Checking messages from User since:", dateLimit);

        const count = await db.collection("messages").countDocuments({
            sender: "User",
            createdAt: { $gte: dateLimit }
        });

        console.log("Total User messages in last 30 days:", count);

        const timeline = await db.collection("messages").aggregate([
            { $match: { sender: "User", createdAt: { $gte: dateLimit } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, // User's local time
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log("Timeline data:", JSON.stringify(timeline, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

check();
