// Provider-agnostic LLM entry — brain yahi call karta hai.
// AI_ORDER env se order (default "groq,gemini"). Jiski key nahi, wo auto-skip.
// Groq down → Gemini brain tools samet sambhalta hai (sirf chatbot fallback nahi).
import logger from "./logger.js";
import { groqChat, type ChatMsg } from "./groq.js";
import { geminiChat } from "./gemini.js";

export type { ChatMsg };

function providerOrder(): string[] {
  const raw = (process.env.AI_ORDER || "groq,gemini")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(raw)];
}

export async function llmChat(messages: ChatMsg[], maxTokens = 500): Promise<string> {
  const order = providerOrder();
  let lastErr: unknown = null;
  for (const p of order) {
    try {
      if (p === "groq") {
        if (!process.env.GROQ_API_KEY) {
          logger.info("[llm] groq key nahi, skip");
          continue;
        }
        return await groqChat(messages, maxTokens);
      }
      if (p === "gemini") {
        if (!process.env.GEMINI_API_KEY) {
          logger.info("[llm] gemini key nahi, skip");
          continue;
        }
        return await geminiChat(messages, maxTokens);
      }
      logger.info({ provider: p }, "[llm] unknown provider, skip");
    } catch (e) {
      lastErr = e;
      logger.error({ provider: p, err: (e as Error).message.slice(0, 120) }, "[llm] fail, agla provider");
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("koi AI available nahi");
}
