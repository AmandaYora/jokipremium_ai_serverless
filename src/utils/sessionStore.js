import fs from "fs";
import os from "os";
import path from "path";

const FALLBACK_MAP = new Map();
const FALLBACK_META = new Map();
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
    FALLBACK_META.set(sessionId, new Date().toISOString());
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

export function listSessions() {
  ensureSessionDir();

  if (useMemoryStore) {
    return Array.from(FALLBACK_MAP.entries()).map(([sessionId, data]) => {
      const history = Array.isArray(data.history) ? data.history : [];
      const lastMessage = history.at(-1);
      return {
        sessionId,
        messageCount: history.length,
        done: Boolean(data.done),
        lastRole: lastMessage?.role ?? null,
        lastText:
          typeof lastMessage?.text === "string" ? lastMessage.text.slice(0, 200) : null,
        updatedAt: FALLBACK_META.get(sessionId) ?? null,
      };
    });
  }

  try {
    const entries = fs.existsSync(sessionDir) ? fs.readdirSync(sessionDir) : [];
    return entries
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const sessionId = path.basename(file, ".json");
        const filePath = sessionFilePath(sessionId);
        let data = null;

        try {
          const raw = fs.readFileSync(filePath, "utf8");
          data = JSON.parse(raw);
        } catch (error) {
          console.warn(
            `[sessionStore] Failed parsing session "${sessionId}": ${error.message}`
          );
        }

        const history = Array.isArray(data?.history) ? data.history : [];
        const lastMessage = history.at(-1);
        let updatedAt = null;

        try {
          const stats = fs.statSync(filePath);
          updatedAt = stats.mtime.toISOString();
        } catch {
          updatedAt = null;
        }

        return {
          sessionId,
          messageCount: history.length,
          done: Boolean(data?.done),
          lastRole: lastMessage?.role ?? null,
          lastText:
            typeof lastMessage?.text === "string" ? lastMessage.text.slice(0, 200) : null,
          updatedAt,
        };
      });
  } catch (error) {
    console.warn(`[sessionStore] Failed listing sessions: ${error.message}`);
    return [];
  }
}

export function deleteSessions(sessionIds = []) {
  ensureSessionDir();

  const normalizedIds = Array.from(
    new Set(
      sessionIds
        .map((value) => (value ?? "").toString().trim())
        .filter((value) => value.length > 0)
    )
  );

  const result = {
    deleted: [],
    missing: [],
    errors: [],
  };

  for (const sessionId of normalizedIds) {
    if (useMemoryStore) {
      if (FALLBACK_MAP.delete(sessionId)) {
        FALLBACK_META.delete(sessionId);
        result.deleted.push(sessionId);
      } else {
        result.missing.push(sessionId);
      }
      continue;
    }

    const filePath = sessionFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      result.missing.push(sessionId);
      continue;
    }

    try {
      fs.unlinkSync(filePath);
      result.deleted.push(sessionId);
    } catch (error) {
      result.errors.push({
        sessionId,
        message: error.message,
      });
    }
  }

  return result;
}
