import { MongoClient } from "mongodb";
const uri = "mongodb://127.0.0.1:27017/visakha_local";
const client = new MongoClient(uri);
async function run() {
    await client.connect();
    const db = client.db("visakha_local");
    const chunks = await db.collection("faq_chunks").find({ sourceType: "FAQ_DB" }).toArray();
    const questions = new Set(chunks.map(c => `[Q]: ${c.question} [A]: ${c.content.substring(0, 50)}...`));
    console.log("Extracted Questions:", Array.from(questions));
    process.exit(0);
}
run().catch(console.error);
//# sourceMappingURL=test-list.js.map