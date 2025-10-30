import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../config/env.js";

let modelInstance = null;

export function getGenerativeModel() {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  if (!modelInstance) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    modelInstance = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  return modelInstance;
}
