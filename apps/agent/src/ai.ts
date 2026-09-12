import { getGroqReply } from "./groq.js";
import { getReply as getGeminiReply } from "./gemini.js";
import { ddgSearch, looksFactual, searchContextBlock } from "./web.js";

// Order: Groq (generous free limits) -> Gemini (fallback)
// Factual sawalon pe web search karke context chipka do — AI khud fetch kare.
export async function getAiReply(userText: string, history: string[] = []): Promise<string> {
  let prompt = userText;
  if (looksFactual(userText)) {
    const hits = await ddgSearch(userText);
    if (hits.length > 0) prompt = userText + searchContextBlock(hits);
    else prompt = userText + "\n\n(Note: web search nahi mil paya, apni knowledge se best jawab do.)";
  }
  const hist = history.slice(-4);
  const order = (process.env.AI_ORDER || "groq,gemini").split(",").map((s) => s.trim());
  let lastErr: unknown = null;
  for (const name of order) {
    try {
      if (name === "groq" && process.env.GROQ_API_KEY) return await getGroqReply(prompt, hist);
      if (name === "gemini" && process.env.GEMINI_API_KEY) return await getGeminiReply(prompt, hist);
    } catch (e) {
      lastErr = e;
      console.error(`[ai] ${name} failed, next try kar rahe...`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("koi AI available nahi");
}
