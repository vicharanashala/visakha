import axios from 'axios';
import fs from 'fs';

async function testExport(range) {
    try {
        console.log("Logging in via dev-login...");
        const loginRes = await axios.post('http://localhost:3000/auth/dev-login');
        const token = loginRes.data.token;

        const tz = 'Asia/Kolkata';

        console.log(`Requesting export: range=${range}, tz=${tz}...`);
        const exportRes = await axios.get(`http://localhost:3000/admin/stats/export?range=${range}&tz=${tz}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Response status:", exportRes.status);
        console.log("First 150 characters of data:\n", exportRes.data.substring(0, 150));

        fs.writeFileSync(`test_export_${range}.csv`, exportRes.data);
        console.log(`Saved to test_export_${range}.csv`);

    } catch (err) {
        console.error("Test failed:", err.response?.data || err.message);
    }
}

async function run() {
    await testExport('month');
    await testExport('24h');
}

run();
