import { useEffect, useState } from "react";
import { fetchSummary, fetchTopQuestions, fetchSourceBreakdown } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

const SOURCE_COLORS: Record<string, string> = {
  FAQ_DB: "#4f6ef7",
  GOLDEN_DB: "#f5a623",
  LLM_FALLBACK: "#5a6a88",
};

function SourceBadge({ type }: { type: string }) {
  const cls = type === "FAQ_DB" ? "faq" : type === "GOLDEN_DB" ? "golden" : "llm";
  return <span className={`badge badge-${cls}`}>{type}</span>;
}

export default function Overview() {
  const [summary, setSummary] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchTopQuestions(8), fetchSourceBreakdown(days)])
      .then(([s, t, b]) => { setSummary(s); setTop(t); setBreakdown(b); })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

  const pieData = summary ? [
    { name: "FAQ_DB", value: summary.faqHits ?? 0 },
    { name: "GOLDEN_DB", value: summary.goldenHits ?? 0 },
    { name: "LLM_FALLBACK", value: summary.llmFallbacks ?? 0 },
  ] : [];

  const kpis = [
    { label: "Total Queries", value: (summary?.totalQueries ?? 0).toLocaleString(), icon: "💬", color: "#4f6ef7", sub: "Since inception" },
    { label: "Active Users", value: (summary?.totalUsers ?? 0).toLocaleString(), icon: "👥", color: "#4f6ef7", sub: "Unique IDs" },
    { label: "DAU", value: (summary?.dau ?? 0).toLocaleString(), icon: "📅", color: "#f5a623", sub: "Last 24 hours" },
    { label: "FAQ Hit Rate", value: `${summary?.faqHitRate ?? 0}%`, icon: "📘", color: "#4f6ef7", sub: `${(summary?.faqHits ?? 0).toLocaleString()} matches` },
    { label: "Golden Rate", value: `${summary?.goldenHitRate ?? 0}%`, icon: "🏆", color: "#f5a623", sub: `${(summary?.goldenHits ?? 0).toLocaleString()} answers` },
    { label: "LLM Fallback", value: `${summary?.llmFallbackRate ?? 0}%`, icon: "🤖", color: "#5a6a88", sub: "Needs knowledge" },
    { label: "Neg Feedback", value: `${summary?.negativeFeedbackRate ?? 0}%`, icon: "👎", color: "#f04747", sub: "Dissatisfaction rate" },
    { label: "Avg Response", value: `${summary?.avgResponseTimeMs ?? 0}ms`, icon: "⚡", color: "#10c98f", sub: "Pipeline latency" },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>System Overview</h1>
        <p>Real-time metrics across the Vi-Sakha AI pipeline</p>
      </div>

      {/* KPI Cards */}
      <div className="cards-grid">
        {kpis.map(k => (
          <div className="kpi-card" key={k.label} style={{ "--card-accent": k.color } as any}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
            <div className="kpi-icon">{k.icon}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Daily trend */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Daily Query Volume</h2>
              <p>Stacked by knowledge source</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setDays(d)} className={`btn btn-sm ${days === d ? "btn-primary" : "btn-ghost"}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdown} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="FAQ_DB" stackId="a" fill="#4f6ef7" />
                <Bar dataKey="GOLDEN_DB" stackId="a" fill="#f5a623" />
                <Bar dataKey="LLM_FALLBACK" stackId="a" fill="#374151" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source pie */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Source Breakdown</h2>
              <p>All-time distribution</p>
            </div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4}>
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] ?? "#5a6a88"} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle" iconSize={9}
                  formatter={(v: string) => <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{v}</span>}
                />
                <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Questions */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Top Questions</h2>
            <p>Most frequently asked — all time</p>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Asks</th>
              <th>Source</th>
              <th>Avg Confidence</th>
              <th>Last Asked</th>
            </tr>
          </thead>
          <tbody>
            {top.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No data yet — start chatting!</td></tr>
            )}
            {top.map((q, i) => (
              <tr key={i}>
                <td style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ maxWidth: 380 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{q.sample || q._id}</div>
                  {q._id !== q.sample && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Normalized: {q._id}</div>}
                </td>
                <td><strong>{q.count}</strong></td>
                <td><SourceBadge type={q.sourceType} /></td>
                <td style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 12 }}>{(q.avgConfidence * 100).toFixed(1)}%</div>
                  <div className="conf-bar"><div className="conf-fill" style={{ width: `${q.avgConfidence * 100}%` }} /></div>
                </td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(q.lastAsked).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
