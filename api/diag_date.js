const formatTimelineKeyOriginal = (date, rangeType, tz) => {
    try {
        const d = new Date(date.toLocaleString('en-US', { timeZone: tz }));
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const H = String(d.getHours()).padStart(2, '0');

        if (rangeType === '24h') return `${Y}-${M}-${D}T${H}:00:00`;
        if (rangeType === 'month') return `${Y}-${M}-01`;
        return `${Y}-${M}-${D}`;
    } catch (e) {
        return `ERROR: ${e.message}`;
    }
};

const test = () => {
    const now = new Date();
    const zones = ['UTC', 'Asia/Kolkata', 'America/New_York'];
    const ranges = ['24h', '30d', 'month'];

    console.log("Current Time (UTC):", now.toISOString());
    console.log("Current Locale String (en-US):", now.toLocaleString('en-US'));

    zones.forEach(tz => {
        console.log(`\n--- Zone: ${tz} ---`);
        ranges.forEach(range => {
            const result = formatTimelineKeyOriginal(now, range, tz);
            console.log(`Range: ${range.padEnd(6)} | Result: ${result}`);
        });
    });
};

test();
