
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
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

        for (const dbInfo of dbs.databases) {
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            if (collections.some(c => c.name === 'admin_users')) {
                console.log(`DB: ${dbInfo.name}`);
                const users = await db.collection('admin_users').find().toArray();
                users.forEach(u => console.log(`  ${u.email} -> ${u.role}`));
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
main();
