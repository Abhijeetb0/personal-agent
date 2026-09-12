import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM = `Tum user ka personal WhatsApp assistant ho. Hinglish me short, friendly reply do.
User ka owner number verified hai. Tum reminders set kar sakte ho, LeetCode contests yaad dila sakte ho, aur general help kar sakte ho.
Rules:
- Short reply (2-4 lines max), WhatsApp style.
- Agar user "yaad dilana / remind karna / contest se pehle batana" bole to confirm karo ki reminder note kar liya (actual save scheduler karega).
- Hindi/Hinglish me baat karo, English tech words chalenge.
- Kabhi ye mat bolo tum AI model ho — bas helpful assistant bano.`;

let model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

function getModel() {
  if (model) return model;
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const gen = new GoogleGenerativeAI(key);
  model = gen.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: SYSTEM });
  return model;
}

export async function getReply(userText: string, history: string[] = []): Promise<string> {
  const m = getModel();
  const context = history.slice(-6).join("\n");
  const prompt = context ? `Pehli baat-cheet:\n${context}\n\nUser: ${userText}` : `User: ${userText}`;
  const res = await m.generateContent(prompt);
  const text = res.response.text().trim();
  return text || "Samajh gaya! Batao aur kya karna hai?";
}
