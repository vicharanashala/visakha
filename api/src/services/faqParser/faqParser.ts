import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ParsedFaqItem {
  topicNo: number;
  topicName: string;
  questionNo: number;       // minor part of N.M
  displayIndex: string;     // e.g. "1.1", "13.20"
  sortKey: number;          // topicNo * 10000 + questionNo * 10 — guarantees natural order
  question: string;
  answer: string;
  content: string;          // "Question: ...\nAnswer: ..." for RAG embedding
}

// Matches the numbered question lines: N.M<optional dot> <question text>
// group 1 = major topic number, group 2 = minor question number, group 3 = question text
const QUESTION_RE = /^(\d{1,2})\.(\d{1,2})\.?\s+(.+)$/;

// Matches topic section headers: N. <Topic Name>
// We use this only for the pre-scan pass to build topic boundaries.
const TOPIC_HEADER_RE = /^(\d{1,2})\.\s+(.+)$/;

/**
 * Parse the full faq.txt file into structured Q&A items.
 *
 * Strategy (two-pass):
 *  Pass 1 — scan the file to find all QUESTION lines (N.M pattern).
 *            Record line numbers and major topic numbers used.
 *  Pass 2 — walk line by line. When we encounter a valid question line,
 *            start a new Q&A item. Accumulate everything until the next
 *            question line (or end of file) as the answer.
 *            Topic name is discovered from the nearest preceding topic
 *            header that matches the question's major number.
 *
 * This avoids the fragile "looksLikeTopic" heuristic by never using the
 * topic header lines to control which question lines are accepted — the
 * questions themselves carry their topic number.
 */
export function parseFaqTxt(filePath?: string): ParsedFaqItem[] {
  const txtPath = filePath ?? path.join(__dirname, "../../../faq.txt");
  const raw = fs.readFileSync(txtPath, "utf-8");

  // Normalise CRLF → LF
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // ── Pass 1: find all valid question line indices ──────────────────────────
  // A line is a "question line" if it matches N.M... AND the preceding lines
  // for the same topic haven't seen a line like "Step N: …", so we rely on
  // the regex alone — N.M at start of line is highly specific.
  const qLineIndices: number[] = [];
  for (let li = 0; li < lines.length; li++) {
    if (QUESTION_RE.test(lines[li].trim())) {
      qLineIndices.push(li);
    }
  }

  // ── Pass 1b: collect topic names by scanning headers ─────────────────────
  // We track ALL N. Topic Name lines and resolve the topic name by the
  // CLOSEST preceding header with matching major number.
  const topicNames: Map<number, string> = new Map();

  for (const line of lines) {
    const m = TOPIC_HEADER_RE.exec(line.trim());
    if (!m) continue;
    const majorNo = parseInt(m[1], 10);
    // Only accept as a topic if it's in 1-14 range
    // AND the name looks like a topic title (not a numbered list item).
    // Key heuristic: a topic title is short (≤ 80 chars) and does NOT
    // contain a verb phrase like "Log in to..." — but we rely on a
    // different, more reliable signal here: does this line number appear
    // as the FIRST occurrence for this major number?
    if (majorNo >= 1 && majorNo <= 14 && !topicNames.has(majorNo)) {
      // Capture this as the topic name (first occurrence wins)
      topicNames.set(majorNo, m[2].trim());
    }
  }

  // ── Pass 2: extract Q&A pairs ─────────────────────────────────────────────
  const items: ParsedFaqItem[] = [];
  const qSet = new Set(qLineIndices);

  let currentMajor = 0;
  let currentMinor = 0;
  let currentDisplayIndex = "";
  let currentQuestion = "";
  let answerLines: string[] = [];

  const flushCurrent = () => {
    if (!currentQuestion) return;
    const answer = answerLines.join("\n").trim();
    const topicName = topicNames.get(currentMajor) ?? `Topic ${currentMajor}`;
    items.push({
      topicNo: currentMajor,
      topicName,
      questionNo: currentMinor,
      displayIndex: currentDisplayIndex,
      sortKey: currentMajor * 10000 + currentMinor * 10,
      question: currentQuestion,
      answer,
      content: `Question: ${currentQuestion}\nAnswer: ${answer}`,
    });
    currentQuestion = "";
    answerLines = [];
  };

  for (let li = 0; li < lines.length; li++) {
    const rawLine = lines[li];
    const line = rawLine.trim();

    if (qSet.has(li)) {
      // This is a valid question line
      flushCurrent();
      const m = QUESTION_RE.exec(line)!;
      currentMajor = parseInt(m[1], 10);
      currentMinor = parseInt(m[2], 10);
      currentDisplayIndex = `${currentMajor}.${currentMinor}`;
      currentQuestion = m[3].trim();
      answerLines = [];
    } else if (currentQuestion) {
      // Accumulate as answer
      answerLines.push(rawLine.trimEnd());
    }
  }

  flushCurrent();

  // ── Sort by sortKey ───────────────────────────────────────────────────────
  items.sort((a, b) => a.sortKey - b.sortKey);

  return items;
}
