import { useEffect, useState } from "react";
import {
  fetchReviewQueue, fetchReviewQueueStats, patchReviewItem, promoteReviewItem,
  fetchQueryLogs, fetchTopQuestions, fetchNegativeFeedback,
} from "../api";
import { CheckCircle, XCircle, Copy, Edit2, ChevronDown, ChevronUp } from "lucide-react";

type Tab = "queue" | "logs" | "stats";
type ReviewType = "potential_golden" | "needs_correction" | "golden_degraded";

function SourceBadge({ type }: { type: string }) {
  const cls = type === "FAQ_DB" ? "faq" : type === "GOLDEN_DB" ? "golden" : "llm";
  return <span className={`badge badge-${cls}`}>{type}</span>;
}
function ReviewTypeBadge({ type }: { type: ReviewType }) {
  if (type === "potential_golden") return <span className="badge badge-potential">✨ Potential Golden</span>;
  if (type === "needs_correction") return <span className="badge badge-correction">⚠ Needs Correction</span>;
  return <span className="badge badge-degraded">📉 Golden Degraded</span>;
}
function StatusBadge({ status }: { status: string }) {
  const cls = status === "pending" ? "pending" : status === "resolved" ? "resolved" : "dismissed";
  return <span className={`badge badge-${cls}`}>{status}</span>;
}

// ── Promote Modal ──────────────────────────────────────────────
function PromoteModal({ item, onClose, onDone }: { item: any; onClose: () => void; onDone: () => void }) {
  const [answer, setAnswer] = useState(item.badAnswer || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handlePromote = async () => {
    if (!answer.trim()) { setErr("Answer is required before promoting."); return; }
    setSaving(true);
    const res = await promoteReviewItem(item._id, { editedAnswer: answer, promotedBy: "admin" });
    setSaving(false);
    if (res.success) { onDone(); onClose(); }
    else setErr(res.error || "Promotion failed");
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>✨ Promote to Golden DB</h2>
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, fontSize: 13 }}>
          <strong>Q:</strong> {item.question}
        </div>
        {err && <div className="alert alert-danger">{err}</div>}
        <div className="form-group">
          <label>Verified Answer</label>
          <textarea className="form-control" rows={6} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Enter or edit the answer to promote..." />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
          This will embed the question, insert into <strong>golden_answers</strong>, and resolve this review item.
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handlePromote} disabled={saving}>
            {saving ? "Promoting…" : "✓ Promote to Golden DB"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Queue Tab ───────────────────────────────────────────
function ReviewQueueTab({ stats }: { stats: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const params: any = { page, limit: 15, status: statusFilter };
    if (typeFilter) params.reviewType = typeFilter;
    fetchReviewQueue(params)
      .then(d => { setItems(d.data || []); setTotal(d.total || 0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, statusFilter, typeFilter]);

  const handleAction = async (id: string, action: string, extra: any = {}) => {
    if (action === "promote") { setPromoting(items.find(i => i._id === id)); return; }
    await patchReviewItem(id, { status: action, resolvedBy: "admin", ...extra });
    load();
  };

  return (
    <div>
      {/* Stat summary */}
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Pending", value: stats.pending, color: "var(--warning)" },
            { label: "Resolved", value: stats.resolved, color: "var(--success)" },
            { label: "Dismissed", value: stats.dismissed, color: "var(--text-muted)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 20px", minWidth: 110 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="">All</option>
        </select>
        <select className="form-control" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="potential_golden">Potential Golden</option>
          <option value="needs_correction">Needs Correction</option>
          <option value="golden_degraded">Golden Degraded</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{total} items</span>
      </div>

      {loading && <div className="loading-wrap"><div className="spinner" /></div>}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>Queue is clear!</h3>
          <p>No items match the current filter.</p>
        </div>
      )}

      {!loading && items.map(item => {
        const isOpen = expanded === item._id;
        const pct = Math.min(100, (item.priorityScore ?? 0));
        return (
          <div className="review-card" key={item._id}>
            {/* Priority bar */}
            <div className="priority-bar">
              <div className="priority-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="review-card-header">
              <div className="review-card-question">{item.question}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <ReviewTypeBadge type={item.reviewType} />
                <StatusBadge status={item.status} />
              </div>
            </div>

            <div className="review-card-meta">
              <SourceBadge type={item.sourceType} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                🔁 {item.occurrences ?? 1}× occurrences
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Priority: <strong style={{ color: "var(--warning)" }}>{item.priorityScore ?? 0}</strong>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Collapsible bad answer */}
            {item.badAnswer && (
              <div>
                <button
                  className="btn btn-ghost btn-xs"
                  style={{ marginBottom: 6 }}
                  onClick={() => setExpanded(isOpen ? null : item._id)}
                >
                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {isOpen ? "Hide" : "Show"} bad answer
                </button>
                {isOpen && <div className="review-card-answer">{item.badAnswer}</div>}
              </div>
            )}

            {/* Actions */}
            {item.status === "pending" && (
              <div className="review-card-actions">
                {item.reviewType === "potential_golden" && (
                  <button className="btn btn-success btn-sm" onClick={() => handleAction(item._id, "promote")}>
                    <CheckCircle size={13} /> Promote to Golden
                  </button>
                )}
                {item.reviewType === "needs_correction" && (
                  <button className="btn btn-warning btn-sm" onClick={() => handleAction(item._id, "promote")}>
                    <Edit2 size={13} /> Edit & Approve
                  </button>
                )}
                {item.reviewType === "golden_degraded" && (
                  <button className="btn btn-warning btn-sm" onClick={() => handleAction(item._id, "promote")}>
                    <Edit2 size={13} /> Review Answer
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => handleAction(item._id, "resolved")}>
                  <CheckCircle size={13} /> Resolve
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleAction(item._id, "duplicate", { isDuplicate: true })}>
                  <Copy size={13} /> Duplicate
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleAction(item._id, "dismissed")}>
                  <XCircle size={13} /> Dismiss
                </button>
              </div>
            )}
            {item.status !== "pending" && item.resolvedBy && (
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {item.status === "resolved" && item.promotedGoldenId
                  ? `✅ Promoted to Golden DB by ${item.resolvedBy}`
                  : `${item.status} by ${item.resolvedBy}`}
                {item.resolvedAt && ` · ${new Date(item.resolvedAt).toLocaleString()}`}
              </div>
            )}
          </div>
        );
      })}

      {total > 15 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="pagination-info">Page {page} of {Math.ceil(total / 15)}</span>
          <button className="btn btn-ghost btn-sm" disabled={items.length < 15} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {promoting && (
        <PromoteModal item={promoting} onClose={() => setPromoting(null)} onDone={load} />
      )}
    </div>
  );
}

// ── Query Logs Tab ─────────────────────────────────────────────
function QueryLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sourceType, setSourceType] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (sourceType) params.sourceType = sourceType;
    if (feedbackStatus) params.feedbackStatus = feedbackStatus;
    fetchQueryLogs(params)
      .then(d => { setLogs(d.data || []); setTotal(d.total || 0); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [page, sourceType, feedbackStatus]);

  return (
    <div>
      <div className="filter-bar">
        <select className="form-control" value={sourceType} onChange={e => { setSourceType(e.target.value); setPage(1); }}>
          <option value="">All Sources</option>
          <option value="FAQ_DB">FAQ_DB</option>
          <option value="GOLDEN_DB">GOLDEN_DB</option>
          <option value="LLM_FALLBACK">LLM_FALLBACK</option>
        </select>
        <select className="form-control" value={feedbackStatus} onChange={e => { setFeedbackStatus(e.target.value); setPage(1); }}>
          <option value="">All Feedback</option>
          <option value="neutral">Neutral</option>
          <option value="positive">👍 Positive</option>
          <option value="negative">👎 Negative</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{total.toLocaleString()} total</span>
      </div>

      <div className="panel">
        {loading && <div className="loading-wrap"><div className="spinner" /></div>}
        {!loading && logs.length === 0 && (
          <div className="empty-state"><div className="empty-icon">🔍</div><p>No logs found</p></div>
        )}
        {!loading && logs.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Question</th>
                <th>Source</th>
                <th>Confidence</th>
                <th>Latency</th>
                <th>Feedback</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 600 }}>{l.userName || l.maskedEmail || "—"}</div>
                    {l.userId && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>UID: {String(l.userId).substring(0, 8)}…</div>}
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{l.question}</div>
                    {l.correctedQuestion !== l.question && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>→ {l.correctedQuestion}</div>
                    )}
                  </td>
                  <td><span className={`badge badge-${l.sourceType === "FAQ_DB" ? "faq" : l.sourceType === "GOLDEN_DB" ? "golden" : "llm"}`}>{l.sourceType}</span></td>
                  <td style={{ minWidth: 100 }}>
                    <div style={{ fontSize: 12 }}>{((l.confidenceScore ?? 0) * 100).toFixed(1)}%</div>
                    <div className="conf-bar"><div className="conf-fill" style={{ width: `${(l.confidenceScore ?? 0) * 100}%` }} /></div>
                  </td>
                  <td style={{ fontSize: 12 }}>{l.responseTimeMs ?? "—"}ms</td>
                  <td style={{ fontSize: 16, textAlign: "center" }}>
                    {l.feedbackStatus === "positive" ? "👍" : l.feedbackStatus === "negative" ? "👎" : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="pagination-info">Page {page} of {Math.ceil(total / 20)}</span>
          <button className="btn btn-ghost btn-sm" disabled={logs.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Feedback Stats Tab ─────────────────────────────────────────
function FeedbackStatsTab() {
  const [top, setTop] = useState<any[]>([]);
  const [negatives, setNegatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTopQuestions(15), fetchNegativeFeedback()])
      .then(([t, n]) => { setTop(t); setNegatives(n); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

  return (
    <div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header"><h2>Most Asked Questions</h2></div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Question</th><th>Asks</th><th>Source</th></tr></thead>
            <tbody>
              {top.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No data yet</td></tr>}
              {top.map((q, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{i + 1}</td>
                  <td style={{ fontWeight: 500, fontSize: 13, maxWidth: 260 }}>{q.sample || q._id}</td>
                  <td><strong>{q.count}</strong></td>
                  <td><span className={`badge badge-${q.sourceType === "FAQ_DB" ? "faq" : q.sourceType === "GOLDEN_DB" ? "golden" : "llm"}`}>{q.sourceType}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>Most Disliked Queries</h2></div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Question</th><th>👎</th><th>Source</th></tr></thead>
            <tbody>
              {negatives.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No negative feedback yet 🎉</td></tr>}
              {negatives.map((q, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{i + 1}</td>
                  <td style={{ fontWeight: 500, fontSize: 13, maxWidth: 260 }}>{q.sample || q._id}</td>
                  <td><strong style={{ color: "var(--danger)" }}>{q.count}</strong></td>
                  <td><span className={`badge badge-${q.sourceType === "FAQ_DB" ? "faq" : q.sourceType === "GOLDEN_DB" ? "golden" : "llm"}`}>{q.sourceType}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Reviews Page ──────────────────────────────────────────
export default function Reviews() {
  const [tab, setTab] = useState<Tab>("queue");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchReviewQueueStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Reviews & Intelligence</h1>
        <p>Manage feedback queue, query logs and feedback analytics</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>
          Review Queue
          {stats?.pending > 0 && <span className="tab-count">{stats.pending}</span>}
        </button>
        <button className={`tab ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>
          Query Logs
        </button>
        <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
          Feedback Stats
        </button>
      </div>

      {tab === "queue" && <ReviewQueueTab stats={stats} />}
      {tab === "logs" && <QueryLogsTab />}
      {tab === "stats" && <FeedbackStatsTab />}
    </div>
  );
}
