import fs from "fs";
import os from "os";
import path from "path";

const FALLBACK_MAP = new Map();
let sessionDir = resolveSessionDir();
let sessionDirReady = false;
let useMemoryStore = false;

function resolveSessionDir() {
  if (process.env.SESSION_DIR) {
    return path.resolve(process.env.SESSION_DIR);
  }

  if (process.env.VERCEL) {
    // Vercel's serverless runtime only allows writes inside /tmp.
    return path.join(os.tmpdir(), "jokipremium-session");
  }

  return path.resolve(process.cwd(), "session");
}

function ensureSessionDir() {
  if (useMemoryStore || sessionDirReady) {
    return;
  }

  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    sessionDirReady = true;
  } catch (error) {
    console.warn(
      `[sessionStore] Falling back to in-memory session storage: ${error.message}`
    );
    useMemoryStore = true;
    sessionDirReady = false;
  }
}

function sessionFilePath(sessionId) {
  return path.join(sessionDir, `${sessionId}.json`);
}

export function loadSession(sessionId) {
  ensureSessionDir();
  if (useMemoryStore) {
    return FALLBACK_MAP.get(sessionId) ?? { history: [], done: false };
  }

  const filePath = sessionFilePath(sessionId);

  if (!fs.existsSync(filePath)) {
    return { history: [], done: false };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.history)) data.history = [];
    if (typeof data.done !== "boolean") data.done = false;
    return data;
  } catch {
    return { history: [], done: false };
  }
}

export function saveSession(sessionId, data) {
  ensureSessionDir();
  if (useMemoryStore) {
    FALLBACK_MAP.set(sessionId, { ...data });
    return;
  }

  const filePath = sessionFilePath(sessionId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function appendMessage(sessionId, role, text) {
  const session = loadSession(sessionId);
  session.history.push({ role, text });
  if (session.history.length > 20) {
    session.history = session.history.slice(session.history.length - 20);
  }
  saveSession(sessionId, session);
}

export function buildHistorySnippet(sessionId) {
  const { history } = loadSession(sessionId);
  const recent = history.slice(-10);
  return recent
    .map((msg) => (msg.role === "user" ? `User: ${msg.text}` : `Assistant: ${msg.text}`))
    .join("\n");
}
