import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ClipboardList, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchReviewQueueStats } from "../api";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Overview", exact: true },
  { to: "/reviews", icon: ClipboardList, label: "Reviews", badgeKey: "pending" },
  { to: "/knowledge", icon: BookOpen, label: "Knowledge Base" },
];

export default function Sidebar() {
  const loc = useLocation();
  const [queueStats, setQueueStats] = useState<any>(null);

  useEffect(() => {
    fetchReviewQueueStats().then(setQueueStats).catch(() => {});
    // Refresh every 60s
    const t = setInterval(() => {
      fetchReviewQueueStats().then(setQueueStats).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🎓</div>
        <div className="sidebar-logo-text">
          <span>Vi-Sakha</span>
          <small>AI Governance</small>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ paddingTop: 8, flex: 1 }}>
        <div className="sidebar-section-label">Platform</div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon: Icon, label, exact, badgeKey }) => {
            const isActive = exact ? loc.pathname === "/" : loc.pathname.startsWith(to);
            const badgeCount = badgeKey && queueStats ? queueStats[badgeKey] : null;
            return (
              <NavLink key={to} to={to} className={`nav-item ${isActive ? "active" : ""}`}>
                <Icon size={16} />
                {label}
                {badgeCount > 0 && (
                  <span className="nav-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section-label">External</div>
        <nav className="sidebar-nav">
          <a
            href="http://localhost:3090"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-item"
          >
            💬
            <span>Open Chatbot</span>
          </a>
        </nav>
      </div>

      {/* Footer — system status */}
      <div className="sidebar-footer">
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
          System Status
        </div>
        <div className="status-item">
          <div className="status-dot green" />
          <span>RAG API — port 3091</span>
        </div>
        <div className="status-item">
          <div className="status-dot green" />
          <span>Chat API — port 3080</span>
        </div>
        <div className="status-item">
          <div className="status-dot green" />
          <span>Admin — port 3092</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-muted)" }}>
          Vi-Sakha v3.0 · Phase-3
        </div>
      </div>
    </aside>
  );
}
