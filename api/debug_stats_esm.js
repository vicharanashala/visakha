import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

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

        const timezone = "Asia/Kolkata";
        const questionsByDate = await db.collection("messages").aggregate([
            { $match: { sender: "User", createdAt: { $gte: dateLimit } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: timezone } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log("Raw timeline data:", JSON.stringify(questionsByDate, null, 2));

        // Simple test of the padding logic
        const formatTimelineKey = (date, rangeType, tz) => {
            const d = new Date(date.toLocaleString('en-US', { timeZone: tz }));
            const Y = d.getFullYear();
            const M = String(d.getMonth() + 1).padStart(2, '0');
            const D = String(d.getDate()).padStart(2, '0');
            return `${Y}-${M}-${D}`;
        };

        const padTimeline = (data, start, end, rangeType, tz) => {
            const result = [];
            const current = new Date(start);
            current.setHours(0, 0, 0, 0);
            const dataMap = new Map(data.map(item => [item._id, item.count]));
            let iterations = 0;
            while (current <= end && iterations < 500) {
                iterations++;
                const key = formatTimelineKey(current, rangeType, tz);
                result.push({ _id: key, count: dataMap.get(key) || 0 });
                current.setDate(current.getDate() + 1);
            }
            return result;
        };

        const padded = padTimeline(questionsByDate, dateLimit, now, '30d', timezone);
        console.log("Padded timeline count:", padded.length);
        console.log("Sample of padded data:", JSON.stringify(padded.slice(0, 5), null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

check();
