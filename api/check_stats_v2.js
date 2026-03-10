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

        console.log("Current Time (UTC):", new Date().toISOString());
        console.log("Current Time (IST):", new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

        const range = '24h';
        const timezone = 'Asia/Kolkata';
        let matchStage = { sender: "User" };
        let dateLimit = new Date();
        dateLimit.setHours(dateLimit.getHours() - 24);
        matchStage.createdAt = { $gte: dateLimit };
        let format = "%Y-%m-%dT%H:00:00";

        console.log("Date boundary (24h):", dateLimit.toISOString());

        const questionsByDate = await db.collection("messages").aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: format, date: "$createdAt", timezone: timezone } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log("Aggregation results:", JSON.stringify(questionsByDate, null, 2));

        const padTimeline = (data, start, end, rangeType, tz) => {
            const result = [];
            const current = new Date(start);
            if (rangeType === '24h') current.setMinutes(0, 0, 0);
            else if (rangeType === 'month') { current.setDate(1); current.setHours(0, 0, 0, 0); }
            else current.setHours(0, 0, 0, 0);

            const dataMap = new Map(data.map(item => [item._id, item.count]));
            const formatKey = (date) => {
                const d = new Date(date.toLocaleString('en-US', { timeZone: tz }));
                const Y = d.getFullYear();
                const M = String(d.getMonth() + 1).padStart(2, '0');
                const D = String(d.getDate()).padStart(2, '0');
                const H = String(d.getHours()).padStart(2, '0');
                if (rangeType === '24h') return `${Y}-${M}-${D}T${H}:00:00`;
                if (rangeType === 'month') return `${Y}-${M}-01`;
                return `${Y}-${M}-${D}`;
            };

            let iterations = 0;
            while (current <= end && iterations < 50) {
                iterations++;
                const key = formatKey(current);
                result.push({ _id: key, count: dataMap.get(key) || 0 });
                if (rangeType === '24h') current.setHours(current.getHours() + 1);
                else if (rangeType === 'month') current.setMonth(current.getMonth() + 1);
                else current.setDate(current.getDate() + 1);
            }
            return result;
        };

        const padded = padTimeline(questionsByDate, dateLimit, new Date(), range, timezone);
        console.log("Final Padded Timeline (last 5):", JSON.stringify(padded.slice(-5), null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
