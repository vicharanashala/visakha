
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
// console.log(`Loading .env from: ${envPath}`);
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) { console.error("No MONGO_URI"); process.exit(1); }

const client = new MongoClient(uri);

async function main() {
    try {
        await client.connect();

        const adminDb = client.db().admin();
        const dbs = await adminDb.listDatabases();

        console.log("DBs found:");
        dbs.databases.forEach(db => console.log(` - ${db.name}`));

        for (const dbInfo of dbs.databases) {
            console.log(`Checking DB: ${dbInfo.name}`);
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();

            for (const col of collections) {
                if (['questions', 'faq', 'faqs', 'help'].some(x => col.name.toLowerCase().includes(x))) {
                    console.log(`\n*** MATCH: ${col.name} in ${dbInfo.name} ***`);
                    const count = await db.collection(col.name).countDocuments();
                    console.log(`Count: ${count}`);
                    if (count > 0) {
                        const docs = await db.collection(col.name).find().limit(2).toArray();
                        console.log(JSON.stringify(docs, null, 2));
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
main();
