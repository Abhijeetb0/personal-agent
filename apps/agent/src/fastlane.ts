import logger from "./logger.js";
import {
  allLeetCodeContests, pastContests, upcomingContests, contestQuestions, formatIST,
} from "./leetcode.js";
import { tryAnswerTimeQuery } from "./tools.js";

// Fast-lane: 100% pakke sawal bina AI ke (token bachta hai, 429 kam).
// Sirf EXPLICIT cases — ambiguous ("uske/iske/ye") hamesha brain ke paas jayega.
const AMBIGUOUS = /(uske|us\s*se|iske|is\s*se|\bye\b|\bwo\b|yeh|iska|uska|iski|uski)\b/i;

function fmtQs(name: string, startAt: Date, qs: { title: string }[]): string {
  const lines = qs.map((q, i) => `${i + 1}. ${q.title}`).join("\n");
  return `${name} (${formatIST(startAt)} IST)\nProblems:\n${lines}`;
}

export async function tryFastLane(text: string): Promise<string | null> {
  // 1. Time — deterministic
  const t = tryAnswerTimeQuery(text);
  if (t) return t;

  // 2. Explicit contest info (reminders yaha nahi — wo brain samjhega)
  if (!/contest|leetcode/i.test(text)) return null;
  if (/(remind|yaad\s*dila|alarm|notify)/i.test(text)) return null;
  if (AMBIGUOUS.test(text)) return null; // context chahiye → brain
  // sirf timing/list intent — "contest kya hota hai" jaise sawal brain ke paas
  if (!/(kab|when|next|agla|konsa|kaunsa|kaun|problems?|questions?|list|tha|the|date|time|batao|dikhao|second\s*last|last|latest|pichla|previous|\d{3})/i.test(text)) return null;

  const low = text.toLowerCase();
  try {
    const all = await allLeetCodeContests();

    const numM = low.match(/(weekly|biweekly)?\s*(contest)?\s*(\d{3})/);
    if (numM) {
      const n = numM[3];
      const found = all.find((c) => c.slug.endsWith(`-${n}`) && (!numM[1] || c.slug.startsWith(numM[1])));
      if (!found) return `Contest ${n} nahi mila.`;
      const qs = await contestQuestions(found.slug);
      if (!qs.length) return `${found.name} (${formatIST(found.startAt)} IST) abhi hua nahi — problems baad me dikhenge.`;
      return fmtQs(found.name, found.startAt, qs);
    }
    if (/second\s*last/i.test(text)) {
      const c = pastContests(all)[1];
      if (!c) return null;
      const qs = await contestQuestions(c.slug);
      return "Usse pehle wala — " + (qs.length ? fmtQs(c.name, c.startAt, qs) : `${c.name} (${formatIST(c.startAt)} IST)`);
    }
    if (/(last|latest|pichla|pichhla|previous)\b/i.test(text)) {
      const c = pastContests(all)[0];
      if (!c) return null;
      const qs = await contestQuestions(c.slug);
      return qs.length ? fmtQs(c.name, c.startAt, qs) : `${c.name} (${formatIST(c.startAt)} IST)`;
    }
    // default: next (kab/agla/next ya sirf "contest")
    const c = upcomingContests(all)[0];
    if (!c) return null;
    return `Next LeetCode contest: ${c.name}\n${formatIST(c.startAt)} (IST) ko hai.\nChaho to bolo "is se 30 min pehle remind kar" — yaad dila dunga!`;
  } catch (e) {
    logger.error({ err: e }, "[fastlane] fail");
    return null;
  }
}
