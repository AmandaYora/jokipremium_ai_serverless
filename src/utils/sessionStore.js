import fs from "fs";
import os from "os";
import path from "path";

// In-memory fallback storage for when filesystem is unavailable
const FALLBACK_MAP = new Map();
const FALLBACK_META = new Map();

// Session storage configuration
let sessionDir = resolveSessionDir();
let sessionDirReady = false;
let useMemoryStore = false;

/**
 * Resolves the session directory based on environment
 * Priority: SESSION_DIR env var > Vercel /tmp > local ./session
 */
function resolveSessionDir() {
  if (process.env.SESSION_DIR) {
    return path.resolve(process.env.SESSION_DIR);
  }

  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    // Vercel's serverless runtime only allows writes inside /tmp
    // This directory is ephemeral and cleared between cold starts
    return path.join(os.tmpdir(), "jokipremium-session");
  }

  return path.resolve(process.cwd(), "session");
}

/**
 * Ensures session directory exists, falls back to memory if needed
 * Optimized for serverless with lazy initialization
 */
function ensureSessionDir() {
  if (useMemoryStore || sessionDirReady) {
    return;
  }

  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    sessionDirReady = true;
    console.log(`[sessionStore] Using file storage: ${sessionDir}`);
  } catch (error) {
    console.warn(
      `[sessionStore] Falling back to in-memory storage: ${error.message}`
    );
    useMemoryStore = true;
    sessionDirReady = false;
  }
}

function sessionFilePath(sessionId) {
  return path.join(sessionDir, `${sessionId}.json`);
}

/**
 * Loads a session from storage (file or memory)
 * Returns default empty session if not found
 */
export function loadSession(sessionId) {
  ensureSessionDir();

  if (useMemoryStore) {
    const session = FALLBACK_MAP.get(sessionId);
    return session ? { ...session } : { history: [], done: false };
  }

  const filePath = sessionFilePath(sessionId);

  if (!fs.existsSync(filePath)) {
    return { history: [], done: false };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    // Validate and normalize session data
    if (!Array.isArray(data.history)) data.history = [];
    if (typeof data.done !== "boolean") data.done = false;

    return data;
  } catch (error) {
    console.error(`[sessionStore] Failed to load session ${sessionId}:`, error.message);
    return { history: [], done: false };
  }
}

/**
 * Saves a session to storage (file or memory)
 * Optimized for serverless with atomic writes
 */
export function saveSession(sessionId, data) {
  ensureSessionDir();

  if (useMemoryStore) {
    FALLBACK_MAP.set(sessionId, { ...data });
    FALLBACK_META.set(sessionId, new Date().toISOString());
    return;
  }

  const filePath = sessionFilePath(sessionId);

  try {
    // Use atomic write: write to temp file, then rename
    const tempPath = `${filePath}.tmp`;
    const content = JSON.stringify(data, null, 2);

    fs.writeFileSync(tempPath, content, "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error(`[sessionStore] Failed to save session ${sessionId}:`, error.message);

    // Fallback to memory if filesystem fails
    if (!useMemoryStore) {
      console.warn("[sessionStore] Switching to in-memory storage due to write failure");
      useMemoryStore = true;
      FALLBACK_MAP.set(sessionId, { ...data });
      FALLBACK_META.set(sessionId, new Date().toISOString());
    }
  }
}

/**
 * Appends a message to session history
 * Automatically trims to last 20 messages to prevent unbounded growth
 */
export function appendMessage(sessionId, role, text) {
  const session = loadSession(sessionId);

  session.history.push({
    role,
    text,
    timestamp: new Date().toISOString(),
  });

  // Keep only the last 20 messages to manage storage size
  if (session.history.length > 20) {
    session.history = session.history.slice(-20);
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
