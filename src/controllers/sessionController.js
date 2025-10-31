import { deleteSessions, listSessions } from "../utils/sessionStore.js";

export function getSessions(req, res) {
  try {
    const sessions = listSessions();
    return res.json({
      ok: true,
      sessions,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "session_list_failed",
      detail: error.message ?? String(error),
    });
  }
}

export function removeSessions(req, res) {
  const payload = req.body ?? {};
  const incomingIds = Array.isArray(payload.sessionIds) ? payload.sessionIds : [];

  if (!Array.isArray(payload.sessionIds)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_payload",
      detail: "Body must include array field sessionIds.",
    });
  }

  if (!incomingIds.some((value) => (value ?? "").toString().trim().length > 0)) {
    return res.status(400).json({
      ok: false,
      error: "empty_session_ids",
      detail: "Provide at least one session id to delete.",
    });
  }

  const result = deleteSessions(incomingIds);
  const success = result.errors.length === 0;

  return res.status(success ? 200 : 207).json({
    ok: success,
    ...result,
  });
}
