import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, MessageSquare, ThumbsUp, ThumbsDown, BarChart2, Calendar, AlertCircle } from 'lucide-react';

interface Stats {
    totals: {
        users: number;
        conversations: number;
        messages: number;
        thumbsUp: number;
        thumbsDown: number;
    };
    questionsTimeline: { _id: string; count: number }[];
}

export function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/admin/stats');
                setStats(res.data);
            } catch (err) {
                console.error("Failed to fetch statistics", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-8 flex items-center justify-center h-full">
            <div className="animate-pulse text-gray-500">Loading statistics...</div>
        </div>;
    }

    if (!stats || !stats.totals || !stats.questionsTimeline) {
        return <div className="p-8 flex items-center justify-center h-full text-red-500">
            <div className="text-center">
                <AlertCircle className="w-10 h-10 mx-auto mb-4 opacity-50" />
                <p className="font-bold">Invalid statistics data received.</p>
                <p className="text-sm opacity-70">Check console for details or try again later.</p>
            </div>
        </div>;
    }

    const timelines = stats.questionsTimeline || [];
    const maxCount = Math.max(...timelines.map(d => d.count || 0), 1);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Dashboard</h1>
                <p className="text-gray-500 dark:text-gray-400">Overview of system activity and user feedback.</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {[
                    { label: 'Total Users', value: stats.totals.users ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Conversations', value: stats.totals.conversations ?? 0, icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                    { label: 'Messages', value: stats.totals.messages ?? 0, icon: BarChart2, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800/50' },
                    { label: 'Thumbs Up', value: stats.totals.thumbsUp ?? 0, icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'Thumbs Down', value: stats.totals.thumbsDown ?? 0, icon: ThumbsDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                ].map((metric) => (
                    <div key={metric.label} className="bg-white dark:bg-brand-card p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
                        <div className={`p-2 rounded-lg ${metric.bg} w-10 h-10 flex items-center justify-center mb-4`}>
                            <metric.icon className={`w-5 h-5 ${metric.color}`} />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">{metric.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Questions Timeline */}
                <div className="lg:col-span-2 bg-white dark:bg-brand-card p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-brand-primary" />
                            Questions Activity (Last 30 Days)
                        </h2>
                    </div>

                    <div className="h-64 flex items-end gap-2 overflow-x-auto pb-4">
                        {timelines.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400">No activity recorded yet.</div>
                        ) : (
                            timelines.map((day) => (
                                <div key={day._id || Math.random()} className="flex-1 flex flex-col items-center group min-w-[40px]">
                                    <div
                                        className="w-full bg-brand-primary/20 dark:bg-brand-primary/10 rounded-t-sm transition-all group-hover:bg-brand-primary group-hover:shadow-[0_0_10px_rgba(var(--brand-primary-rgb),0.5)] cursor-help relative"
                                        style={{ height: `${((day.count || 0) / maxCount) * 100}%` }}
                                        title={`${day._id || 'Unknown'}: ${day.count || 0} questions`}
                                    >
                                        <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10">
                                            {day.count || 0} Qs
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-2 -rotate-45 origin-top-left translate-x-1 font-medium italic">
                                        {day._id ? day._id.split('-').slice(1).join('/') : '??'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Feedback Distribution */}
                <div className="bg-white dark:bg-brand-card p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <h2 className="text-lg font-bold mb-6">Feedback Ratio</h2>
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-600">Positive</span>
                            <span className="text-sm font-bold">{((stats.totals.thumbsUp / (stats.totals.thumbsUp + stats.totals.thumbsDown || 1)) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex mb-8">
                            <div
                                className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                                style={{ width: `${(stats.totals.thumbsUp / (stats.totals.thumbsUp + stats.totals.thumbsDown || 1)) * 100}%` }}
                            />
                            <div
                                className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                                style={{ width: `${(stats.totals.thumbsDown / (stats.totals.thumbsUp + stats.totals.thumbsDown || 1)) * 100}%` }}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                                    <span>Thumbs Up</span>
                                </div>
                                <span className="font-bold">{stats.totals.thumbsUp}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                                    <span>Thumbs Down</span>
                                </div>
                                <span className="font-bold">{stats.totals.thumbsDown}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
