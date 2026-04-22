const API = import.meta.env.VITE_API_URL || "http://localhost:3091";

export async function fetchSummary() {
  const r = await fetch(`${API}/analytics/summary`);
  return r.json();
}
export async function fetchTopQuestions(limit = 10) {
  const r = await fetch(`${API}/analytics/top-questions?limit=${limit}`);
  return r.json();
}
export async function fetchSourceBreakdown(days = 30) {
  const r = await fetch(`${API}/analytics/source-breakdown?days=${days}`);
  return r.json();
}
export async function fetchNegativeFeedback() {
  const r = await fetch(`${API}/analytics/negative-feedback`);
  return r.json();
}

// ── Review Queue ─────────────────────────────────────
export async function fetchReviewQueue(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API}/review-queue?${qs}`);
  return r.json();
}
export async function fetchReviewQueueStats() {
  const r = await fetch(`${API}/review-queue/stats`);
  return r.json();
}
export async function patchReviewItem(id: string, payload: Record<string, any>) {
  const r = await fetch(`${API}/review-queue/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}
export async function promoteReviewItem(id: string, payload: { answer?: string; editedAnswer?: string; tags?: string[]; promotedBy?: string }) {
  const r = await fetch(`${API}/review-queue/${id}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}
export async function fetchQueryLogs(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API}/query-log?${qs}`);
  return r.json();
}
export async function fetchPendingReviews(status = "pending", page = 1) {
  const r = await fetch(`${API}/pending-reviews?status=${status}&page=${page}`);
  return r.json();
}
export async function patchPendingReview(id: string, status: string) {
  const r = await fetch(`${API}/pending-reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return r.json();
}
export async function fetchGolden(page = 1, status = "approved") {
  const r = await fetch(`${API}/knowledge/golden?page=${page}&status=${status}`);
  return r.json();
}
export async function fetchGoldenSuggestions(page = 1) {
  const r = await fetch(`${API}/knowledge/golden-suggestions?page=${page}`);
  return r.json();
}
export async function patchGoldenSuggestion(id: string, status: string) {
  const r = await fetch(`${API}/knowledge/golden-suggestions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return r.json();
}
export async function createGolden(payload: { question: string; answer: string; tags?: string[] }) {
  const r = await fetch(`${API}/knowledge/golden`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}
export async function updateGolden(id: string, payload: Partial<{ question: string; answer: string; status: string; tags: string[] }>) {
  const r = await fetch(`${API}/knowledge/golden/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}
export async function deleteGolden(id: string) {
  const r = await fetch(`${API}/knowledge/golden/${id}`, { method: "DELETE" });
  return r.json();
}

/** @deprecated Use fetchFaqTopics for admin dashboard */
export async function fetchFaq(page = 1) {
  const r = await fetch(`${API}/knowledge/faq?page=${page}`);
  return r.json();
}

/** Fetches all FAQ chunks grouped by topic from the server — no client-side pagination needed. */
export async function fetchFaqTopics(): Promise<{
  total: number;
  topics: Array<{
    topicNo: number;
    topicName: string;
    questions: Array<{
      _id: string;
      displayIndex: string;
      sortKey: number;
      question: string;
      answer: string;
    }>;
  }>;
}> {
  const r = await fetch(`${API}/knowledge/faq/topics`);
  return r.json();
}

/** Triggers FAQ re-ingestion from the server-side faq.txt file */
export async function reingestFaq(): Promise<{
  success: boolean;
  topicsDetected?: number;
  questionsStored?: number;
  deletedOld?: number;
  error?: string;
}> {
  const r = await fetch(`${API}/api/admin/reingest-faq`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": "visakha-local-admin-secret-2024",
    },
  });
  return r.json();
}

export async function promoteToGolden(review: { question: string; generatedAnswer?: string }) {
  return createGolden({ question: review.question, answer: review.generatedAnswer || "" });
}
