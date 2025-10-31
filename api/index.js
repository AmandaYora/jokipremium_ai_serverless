import app from "../src/app.js";

// Vercel serverless function handler
// Note: We let Express handle body parsing via express.json() middleware
export default async function handler(req, res) {
  // Ensure proper error handling for serverless environment
  try {
    return await app(req, res);
  } catch (error) {
    console.error("[Vercel Handler] Unhandled error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        error: "internal_server_error",
        detail: process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message,
      });
    }
  }
}
