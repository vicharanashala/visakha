import { useEffect, useState } from "react";
import {
  fetchGolden,
  fetchFaqTopics,
  createGolden,
  updateGolden,
  deleteGolden,
  reingestFaq,
} from "../api";
import { Plus, Edit2, Trash2, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Golden = {
  _id: string;
  question: string;
  answer: string;
  tags?: string[];
  status: string;
  createdAt: string;
};



type FaqQuestion = {
  _id: string;
  displayIndex: string;
  sortKey: number;
  question: string;
  answer: string;
};

type FaqTopic = {
  topicNo: number;
  topicName: string;
  questions: FaqQuestion[];
};

// ─── Golden Answer Editor Modal ───────────────────────────────────────────────

function GoldenEditor({
  item,
  onClose,
  onSave,
}: {
  item: Partial<Golden> | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [question, setQuestion] = useState(item?.question || "");
  const [answer, setAnswer] = useState(item?.answer || "");
  const [tags, setTags] = useState((item?.tags || []).join(", "));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (item?._id) {
      await updateGolden(item._id, { question, answer, tags: tagArr });
    } else {
      await createGolden({ question, answer, tags: tagArr });
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{item?._id ? "Edit Golden Answer" : "New Golden Answer"}</h2>
        <div className="form-group">
          <label>Question</label>
          <input className="form-control" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Answer</label>
          <textarea className="form-control" rows={7} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input className="form-control" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="stipend, eligibility..." />
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={saving || !question.trim() || !answer.trim()}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FAQ Topic Accordion Row ──────────────────────────────────────────────────

function FaqTopicCard({ topic }: { topic: FaqTopic }) {
  const [open, setOpen] = useState(false);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  const toggleQ = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedQ((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        marginBottom: "16px",
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Topic header */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 20px",
          cursor: "pointer",
          background: "var(--surface)",
          userSelect: "none",
          transition: "background-color 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface2)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--surface)")}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "16px" }}>📚</span>
          {topic.topicNo}. {topic.topicName} ({topic.questions.length})
        </span>
      </div>

      {/* Question rows */}
      {open && (
        <div style={{ padding: "0 12px 12px" }}>
          {topic.questions.map((q) => (
            <div
              key={q._id}
              style={{
                marginBottom: "8px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: expandedQ === q._id ? "var(--surface)" : "var(--surface2)",
                overflow: "hidden",
                transition: "all 0.2s ease"
              }}
            >
              {/* Question row */}
              <div
                onClick={(e) => toggleQ(q._id, e)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                   if (expandedQ !== q._id) e.currentTarget.style.backgroundColor = "var(--surface)";
                }}
                onMouseLeave={(e) => {
                   if (expandedQ !== q._id) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span style={{ color: "var(--primary)", fontSize: "14px", marginTop: "2px", fontWeight: 700, minWidth: "20px" }}>
                  {expandedQ === q._id ? "▼" : "▶"}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: expandedQ === q._id ? "var(--text)" : "var(--text-muted)",
                    lineHeight: "1.5",
                    flex: 1,
                  }}
                >
                  {q.displayIndex} {q.question}
                </span>
              </div>

              {/* Expanded answer */}
              {expandedQ === q._id && (
                <div
                  style={{
                    padding: "0 16px 16px 46px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "var(--text-muted)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {q.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Knowledge Page ──────────────────────────────────────────────────────

export default function Knowledge() {
  const [tab, setTab] = useState<"faq" | "golden">("faq");
  const [goldens, setGoldens] = useState<Golden[]>([]);
  const [topics, setTopics] = useState<FaqTopic[]>([]);
  const [faqTotal, setFaqTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Golden> | null | false>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [goldenTotal, setGoldenTotal] = useState(0);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const ITEMS_PER_PAGE = 20;

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadGolden = () => {
    setLoading(true);
    fetchGolden(page)
      .then((d: any) => {
        setGoldens(d.data ?? []);
        setGoldenTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  const loadFaq = async () => {
    setLoading(true);
    try {
      const d = await fetchFaqTopics();
      setTopics(d.topics ?? []);
      setFaqTotal(d.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    if (tab === "golden") loadGolden();
    else loadFaq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "golden") loadGolden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const softDelete = async (id: string) => {
    setDeletingId(id);
    await deleteGolden(id);
    setDeletingId(null);
    loadGolden();
  };

  const handleReingest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const result = await reingestFaq();
      if (result.success) {
        setIngestMsg({
          ok: true,
          text: `✅ Ingested ${result.questionsStored} questions across ${result.topicsDetected} topics. (Removed ${result.deletedOld} old records)`,
        });
        if (tab === "faq") await loadFaq();
      } else {
        setIngestMsg({ ok: false, text: `❌ Ingest failed: ${result.error}` });
      }
    } catch (e: any) {
      setIngestMsg({ ok: false, text: `❌ Error: ${e.message}` });
    } finally {
      setIngesting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">
      {/* Header row */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Knowledge Base</h1>
          <p>Manage the FAQ structure and approved Golden Answers</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" disabled={ingesting} onClick={handleReingest} title="Re-parse faq.txt">
            <RefreshCw size={14} style={{ animation: ingesting ? "spin 1s linear infinite" : "none" }} />
            {ingesting ? "Ingesting…" : "Re-Ingest FAQ"}
          </button>
          {tab === "golden" && (
            <button className="btn btn-primary" onClick={() => setEditing({})}>
              <Plus size={14} /> New Answer
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "faq" ? "active" : ""}`} onClick={() => setTab("faq")}>
          📘 FAQ Base
        </button>
        <button className={`tab ${tab === "golden" ? "active" : ""}`} onClick={() => setTab("golden")}>
          🏆 Golden DB
        </button>
      </div>

      {ingestMsg && (
        <div className={`alert alert-${ingestMsg.ok ? "success" : "danger"}`}>
          <div style={{ flex: 1 }}>{ingestMsg.text}</div>
          <button onClick={() => setIngestMsg(null)} className="btn btn-ghost btn-sm" style={{ padding: 2 }}>✕</button>
        </div>
      )}

      <div className="panel">
        {loading && <div className="loading-wrap"><div className="spinner" /></div>}

        {!loading && tab === "faq" && (
          <div className="panel-body">
            {topics.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>No FAQ data</h3>
                <p>Click Re-Ingest FAQ to load from the static text file.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 16, padding: "10px 16px", marginBottom: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)" }}>
                  <span><strong style={{ color: "var(--primary)" }}>{topics.length}</strong> topics</span>
                  <span><strong style={{ color: "var(--primary)" }}>{faqTotal}</strong> questions</span>
                  <span style={{ marginLeft: "auto" }}>Source: faq.txt</span>
                </div>
                {topics.map(topic => <FaqTopicCard key={topic.topicNo} topic={topic} />)}
              </div>
            )}
          </div>
        )}

        {!loading && tab === "golden" && (
          <div>
            {goldens.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🏆</div>
                <h3>No Golden Answers</h3>
                <p>Promote answers from the Review Queue or create them manually.</p>
              </div>
            )}
            {goldens.length > 0 && (
              <table className="data-table">
                <thead><tr><th>Question</th><th>Answer</th><th>Tags</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {goldens.map(g => (
                    <tr key={g._id}>
                      <td style={{ maxWidth: 240, fontWeight: 500 }}>{g.question}</td>
                      <td style={{ maxWidth: 320, color: "var(--text-muted)", fontSize: 12 }}>{g.answer.slice(0, 120)}{g.answer.length > 120 ? "…" : ""}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(g.tags || []).map(t => <span key={t} style={{ fontSize: 10, padding: "2px 6px", background: "var(--surface3)", borderRadius: 4 }}>{t}</span>)}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(g.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(g)}><Edit2 size={12} /></button>
                          <button className="btn btn-danger btn-sm" disabled={deletingId === g._id} onClick={() => softDelete(g._id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {tab === "golden" && goldenTotal > ITEMS_PER_PAGE && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="pagination-info">Page {page} of {Math.ceil(goldenTotal / ITEMS_PER_PAGE)}</span>
          <button className="btn btn-ghost btn-sm" disabled={goldens.length < ITEMS_PER_PAGE} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {editing !== false && (
        <GoldenEditor
          item={editing || {}}
          onClose={() => setEditing(false)}
          onSave={() => { setEditing(false); loadGolden(); }}
        />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
