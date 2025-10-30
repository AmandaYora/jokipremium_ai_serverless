import "dotenv/config";

export const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

if (!GEMINI_API_KEY) {
  // Provide guidance during startup without crashing the app.
  console.warn(
    "[config] Missing GEMINI_API_KEY. Requests to Google Generative AI will fail until it is set."
  );
}
