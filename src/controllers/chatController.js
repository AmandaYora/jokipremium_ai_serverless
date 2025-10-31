import {
  appendMessage,
  buildHistorySnippet,
  loadSession,
  saveSession,
} from "../utils/sessionStore.js";
import { buildPrompt } from "../utils/promptBuilder.js";
import { getGenerativeModel } from "../services/geminiClient.js";
import { getTimeContext } from "../utils/timeUtils.js";
import { getHolidayInfoForDate } from "../services/holidayService.js";

const GREETING_PATTERNS = [
  /^(selamat\s+(pagi|siang|sore|malam))/i,
  /^(halo|hai|assalamu['`’]alaikum|assalamualaikum|hi)\b/i,
  /^saya\s+minjo\b/i,
  /^perkenalkan\b/i,
];

function stripMarkdownEmphasis(text) {
  return text
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, "$1")
    .replace(/__(\S(?:.*?\S)?)__/g, "$1")
    .replace(/\*(\S(?:.*?\S)?)\*/g, "$1")
    .replace(/_(\S(?:.*?\S)?)_/g, "$1");
}

function sanitizeAssistantOutput(text, allowGreeting) {
  const trimmed = text?.trim() ?? "";
  if (trimmed === "") {
    return "";
  }

  if (allowGreeting) {
    return stripMarkdownEmphasis(trimmed);
  }

  const lines = trimmed.split(/\r?\n/);
  let firstContentIndex = 0;

  while (firstContentIndex < lines.length && lines[firstContentIndex].trim() === "") {
    firstContentIndex += 1;
  }

  if (firstContentIndex < lines.length) {
    const firstLine = lines[firstContentIndex].trimStart();
    if (GREETING_PATTERNS.some((regex) => regex.test(firstLine))) {
      lines.splice(firstContentIndex, 1);
    }
  }

  // Remove leading empty lines after potential removal.
  while (lines.length && lines[0].trim() === "") {
    lines.shift();
  }

  const normalized = lines.join("\n").trim();
  return normalized ? stripMarkdownEmphasis(normalized) : normalized;
}

const WHATSAPP_TRIGGERS = [
  "klik tombol whatsapp",
  "hubungi whatsapp",
  "whatsapp admin",
  "konfirmasi langsung dengan tim",
];

const END_TRIGGERS = [
  "silakan isi form di website jokipremium",
  "silakan isi form di website",
  "silakan isi form jokipremium",
  "silakan isi form di halaman website jokipremium",
  "silakan isi form di halaman website",
  "silakan lanjut isi form di website jokipremium",
  "silakan lanjut isi form di website",
];

const FALLBACK_MESSAGE =
  "Untuk hal itu saya perlu konfirmasi langsung dengan tim. Bisa klik tombol WhatsApp admin Jokipremium di website ya dY~S";

export async function handleChat(req, res) {
  const sessionId = (req.body?.sessionId || "").toString().trim();
  const userQuestion = (req.body?.question || "").toString().trim();

  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "sessionId is required" });
  }

  if (!userQuestion) {
    return res.status(400).json({ ok: false, error: "question is required" });
  }

  let sessionData = loadSession(sessionId);

  if (sessionData.done) {
    return res.json({
      ok: true,
      answer: "Terima kasih, silakan lanjut isi form di website Jokipremium ya dY~S",
    });
  }

  const now = new Date();
  const timeContext = getTimeContext(now);
  let holidayInfo = null;
  try {
    holidayInfo = await getHolidayInfoForDate(now);
  } catch (error) {
    console.warn(`[chatController] Holiday lookup failed: ${error.message}`);
  }

  const normalizedQuestion = userQuestion.toLowerCase();
  const isSessionResetCommand = normalizedQuestion.includes("mulai baru");

  if (isSessionResetCommand) {
    sessionData = { history: [], done: false };
    saveSession(sessionId, sessionData);
  }

  const shouldGreet =
    isSessionResetCommand || !sessionData.history.some((item) => item.role === "assistant");

  appendMessage(sessionId, "user", userQuestion);

  const prompt = buildPrompt({
    userQuestion,
    sessionId,
    timeContext,
    holidayInfo,
    shouldGreet,
  });

  let model;
  try {
    model = getGenerativeModel();
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "missing_api_key",
      detail: err.message ?? String(err),
    });
  }

  let rawAnswer = "";
  try {
    const result = await model.generateContent(prompt);
    rawAnswer = result.response?.text?.() || "";
  } catch (err) {
    const message = err?.message ?? String(err);
    if (err?.code === "ECONNRESET" || message.includes("ECONNRESET")) {
      return res.status(503).json({
        ok: false,
        error: "upstream_connection_reset",
        detail: "Koneksi ke layanan AI Google terputus. Coba lagi nanti atau periksa koneksi internet server.",
      });
    }

    return res.status(502).json({
      ok: false,
      error: "upstream_error",
      detail: message,
    });
  }

  let finalAnswer = rawAnswer.trim();
  if (finalAnswer === "") {
    finalAnswer = FALLBACK_MESSAGE;
  }

  finalAnswer = sanitizeAssistantOutput(finalAnswer, shouldGreet);
  if (finalAnswer === "") {
    finalAnswer = FALLBACK_MESSAGE;
  }

  const convoSummary = buildHistorySnippet(sessionId).split("\n").slice(-6).join("\n");
  const lowered = finalAnswer.toLowerCase();

  if (WHATSAPP_TRIGGERS.some((trigger) => lowered.includes(trigger))) {
    finalAnswer += `

Berikut template pesan WhatsApp yang bisa langsung kamu kirim ke admin Jokipremium:

---
Halo admin Jokipremium dY\`<
Saya sudah berdiskusi dengan AI Assistant Jokipremium (Minjo) dan diarahkan lanjut ke WhatsApp.

1. Kebutuhan saya:
   (apa yang saya inginkan / minta dibantu)
2. Kenapa diteruskan ke admin:
   (AI bilang kasus ini perlu bantuan tim langsung)
3. Catatan analisa AI:
   (ringkasnya seperti ini)
   ${convoSummary}
4. Saran lanjutan dari AI:
   (mohon dibantu lanjutkan diskusinya, termasuk scope yang realistis, estimasi pengerjaan, dan arah teknis berikutnya)
---

Silakan kirim template ini lewat tombol WhatsApp di website ya dY~S`;
  }

  if (END_TRIGGERS.some((trigger) => lowered.includes(trigger))) {
    const latestSession = loadSession(sessionId);
    latestSession.done = true;
    latestSession.history.push({ role: "assistant", text: finalAnswer });
    saveSession(sessionId, latestSession);

    return res.json({ ok: true, answer: finalAnswer });
  }

  appendMessage(sessionId, "assistant", finalAnswer);
  return res.json({ ok: true, answer: finalAnswer });
}
