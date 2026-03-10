import axios from 'axios';
import fs from 'fs';

async function testExport() {
    try {
        console.log("Logging in via dev-login...");
        const loginRes = await axios.post('http://localhost:3000/auth/dev-login');
        const token = loginRes.data.token;
        console.log("Token acquired.");

        const range = '30d';
        const tz = 'Asia/Kolkata';

        console.log(`Requesting export: range=${range}, tz=${tz}...`);
        const exportRes = await axios.get(`http://localhost:3000/admin/stats/export?range=${range}&tz=${tz}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Response status:", exportRes.status);
        console.log("Response headers:", exportRes.headers);
        console.log("First 100 characters of data:\n", exportRes.data.substring(0, 100));

        fs.writeFileSync('test_export.csv', exportRes.data);
        console.log("Saved to test_export.csv");

    } catch (err) {
        console.error("Test failed:", err.response?.data || err.message);
    }
}

testExport();
