// Simulation of the exact logic in index.ts
const formatTimelineKey = (date, rangeType, tz) => {
    try {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hour12: false
        });
        const parts = dtf.formatToParts(date);
        const p = {};
        parts.forEach(part => { p[part.type] = part.value; });

        const Y = p.year;
        const M = p.month;
        const D = p.day;
        const H = p.hour === '24' ? '00' : p.hour;

        if (rangeType === '24h') return `${Y}-${M}-${D}T${H}:00:00`;
        if (rangeType === 'month') return `${Y}-${M}-01`;
        return `${Y}-${M}-${D}`;
    } catch (e) {
        return date.toISOString().split('.')[0];
    }
};

const padTimeline = (data, start, end, rangeType, tz) => {
    const result = [];
    const current = new Date(start);

    if (rangeType === '24h') current.setMinutes(0, 0, 0);
    else if (rangeType === 'month') {
        current.setDate(1);
        current.setHours(0, 0, 0, 0);
    }
    else current.setHours(0, 0, 0, 0);

    const dataMap = new Map(data.map(item => [item._id, item.count]));

    let iterations = 0;
    while (current <= end && iterations < 50) { // Limit for simulation
        iterations++;
        const key = formatTimelineKey(current, rangeType, tz);
        result.push({
            _id: key,
            count: dataMap.get(key) || 0
        });

        if (rangeType === '24h') current.setHours(current.getHours() + 1);
        else if (rangeType === 'month') current.setMonth(current.getMonth() + 1);
        else current.setDate(current.getDate() + 1);
    }
    return result;
};

const test = () => {
    const now = new Date("2026-03-10T10:07:44Z");
    const tz = "Asia/Kolkata";
    const start = new Date(now);
    start.setDate(start.getDate() - 2); // 2 days for simple test

    // Fake data from MongoDB using the internal format
    const mockData = [
        { _id: "2026-03-09", count: 123 }
    ];

    console.log("Range: 30d simulation");
    const timeline = padTimeline(mockData, start, now, "30d", tz);
    console.log(JSON.stringify(timeline, null, 2));

    console.log("\nRange: 24h simulation");
    const start24 = new Date(now);
    start24.setHours(start24.getHours() - 5);
    const mockData24 = [
        { _id: "2026-03-10T15:00:00", count: 10 } // 10:00 AM UTC is 3:30 PM Kolkata
    ];
    const timeline24 = padTimeline(mockData24, start24, now, "24h", tz);
    console.log(JSON.stringify(timeline24, null, 2));
};

test();
