# Vi-Sakha Intelligence Backend & Admin Platform — `visakha-main`

> PR Reviewer Note: This repo contains the custom intelligence backend + admin governance dashboard for Vi-Sakha.

## Purpose

This repository powers:

* Smart RAG retrieval (`FAQ_DB`, `GOLDEN_DB`, `LLM_FALLBACK`)
* Query logging + user analytics
* Feedback-driven review workflow
* Admin dashboard for monitoring AI performance
* Knowledge base management

---

# Key Highlights (Important for PR Review)

## 📊 Admin Analytics Dashboard

Tracks:

* Total Queries
* Total Users
* DAU (Daily Active Users)
* FAQ Hit %
* Golden Hit %
* LLM Fallback %
* Negative Feedback %
* Avg Response Time

## 📋 Query Logs

Every user query is logged with:

* userId / userName
* original query
* corrected query
* source used
* confidence score
* feedback status
* response time

## 🔁 Review Queue

Human-in-the-loop moderation:

* 👍 Good LLM answers → candidate for GOLDEN_DB
* 👎 Bad LLM answers → needs correction
* Degraded GOLDEN answers → flagged automatically

## 📚 Knowledge Manager

Admin can:

* Browse FAQ topics/questions
* Add/Edit/Delete GOLDEN answers
* Re-ingest FAQ from source file

---

# Main Files Modified

## Backend API (`api/src/routes/`)

* `rag.ts` → Hybrid RAG pipeline
* `analytics.ts` → KPI APIs
* `queryLog.ts` → Query audit logs
* `reviewQueue.ts` → Human review workflow
* `knowledge.ts` → FAQ + GOLDEN CRUD
* `feedback.ts` → Feedback routing

## Services

* `queryNormalizer.ts` → typo correction
* `embedder.ts` → MiniLM embeddings
* `faqParser.ts` → structured FAQ ingestion

## Admin UI (`admin-ui/src/pages/`)

* `Overview.tsx`
* `Reviews.tsx`
* `Knowledge.tsx`

---

# Architecture

```text
Chat UI (3090)
   ↓
sakha-client-main backend (3080)
   ↓
Vi-Sakha API (3091)
   ├─ RAG Search
   ├─ Analytics
   ├─ Feedback Routing
   ├─ Query Logs
   └─ Knowledge Base

Admin Dashboard (3092)
```

---

# Tech Stack

* Node.js
* TypeScript
* Express
* MongoDB
* React + Vite
* Recharts
* Xenova MiniLM embeddings
* Fuse.js

---

# Run Locally

## Backend API

```bash
cd visakha-main/api
npm install
npm run dev
```

## Admin Dashboard

```bash
cd visakha-main/admin-ui
npm install
npm run dev
```

## URLs

* API: http://localhost:3091
* Dashboard: http://localhost:3092

---

# Why This PR Matters

This repo transforms a normal chatbot into a **governable enterprise AI system** with analytics, traceability, moderation, and continuous improvement.
