import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import Reviews from "./pages/Reviews";
import Knowledge from "./pages/Knowledge";
import "./index.css";

function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div>
          <div className="topbar-title">{title}</div>
          {subtitle && <div className="topbar-breadcrumb">{subtitle}</div>}
        </div>
      </div>
      <div className="topbar-right">
        <a
          href="http://localhost:3090"
          target="_blank"
          rel="noopener noreferrer"
          className="chatbot-link"
          title="Open Vi-Sakha Chatbot"
        >
          💬 Open Chatbot
        </a>
        <div className="live-badge">
          <span className="status-dot green" style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block" }} />
          RAG Live
        </div>
      </div>
    </div>
  );
}

function Layout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Topbar title={title} subtitle={subtitle} />
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout title="Overview" subtitle="System health & key metrics">
              <Overview />
            </Layout>
          }
        />
        <Route
          path="/reviews"
          element={
            <Layout title="Reviews" subtitle="Feedback queue, query logs & analytics">
              <Reviews />
            </Layout>
          }
        />
        <Route
          path="/knowledge"
          element={
            <Layout title="Knowledge Base" subtitle="FAQ, Golden DB & suggestions">
              <Knowledge />
            </Layout>
          }
        />
        {/* Legacy redirects */}
        <Route path="/analytics" element={<Navigate to="/" replace />} />
        <Route path="/pending" element={<Navigate to="/reviews" replace />} />
        <Route path="/logs" element={<Navigate to="/reviews" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
