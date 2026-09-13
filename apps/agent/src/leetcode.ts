// LeetCode upcoming contests — free, no key.
// Primary: LeetCode official GraphQL. Fallback: kontests.net.
import logger from "./logger.js";

export type Contest = { name: string; startAt: Date; url: string };

async function fromLeetCodeOfficial(): Promise<Contest | null> {
  const r = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      query: "{ upcomingContests { title titleSlug startTime duration } }",
    }),
    signal: AbortSignal.timeout(15000),
  } as any);
  if (!r.ok) throw new Error(`leetcode graphql ${r.status}`);
  const j = (await r.json()) as any;
  const list = (j?.data?.upcomingContests as any[]) || [];
  const upcoming = list
    .map((c) => ({
      name: c.title as string,
      startAt: new Date(Number(c.startTime) * 1000),
      url: `https://leetcode.com/contest/${c.titleSlug}`,
    }))
    .filter((c) => c.startAt.getTime() > Date.now())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return upcoming[0] ?? null;
}

async function fromKontests(): Promise<Contest | null> {
  const r = await fetch("https://kontests.net/api/v1/leet_code", {
    headers: { "User-Agent": "personal-agent" },
    signal: AbortSignal.timeout(15000),
  } as any);
  if (!r.ok) throw new Error(`kontests ${r.status}`);
  const list = (await r.json()) as any[];
  const upcoming = list
    .map((c) => ({
      name: c.name as string,
      startAt: new Date(c.start_time),
      url: c.url as string,
    }))
    .filter((c) => c.startAt.getTime() > Date.now())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return upcoming[0] ?? null;
}

export async function nextLeetCodeContest(): Promise<Contest | null> {
  try {
    return await fromLeetCodeOfficial();
  } catch (e) {
    logger.error({ err: e }, "[leetcode] official failed, trying kontests");
  }
  try {
    return await fromKontests();
  } catch (e) {
    logger.error({ err: e }, "[leetcode] fetch failed");
    return null;
  }
}

export type ContestQuestions = { name: string; startAt: Date; questions: { title: string; url: string }[] };

// Contest list 10 min cache — har sawal pe API mat maaro
let allCache: { at: number; data: { name: string; slug: string; startAt: Date }[] } | null = null;

export async function allLeetCodeContests(): Promise<{ name: string; slug: string; startAt: Date }[]> {
  if (allCache && Date.now() - allCache.at < 10 * 60_000) return allCache.data;
  const r = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query: "{ allContests { title titleSlug startTime } }" }),
    signal: AbortSignal.timeout(15000),
  } as any);
  if (!r.ok) throw new Error(`leetcode graphql ${r.status}`);
  const j = (await r.json()) as any;
  const data = ((j?.data?.allContests as any[]) || []).map((c) => ({
    name: c.title as string,
    slug: c.titleSlug as string,
    startAt: new Date(Number(c.startTime) * 1000),
  }));
  allCache = { at: Date.now(), data };
  return data;
}

export function pastContests(list: { name: string; slug: string; startAt: Date }[]) {
  return list.filter((c) => c.startAt.getTime() < Date.now()).sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
}

export function upcomingContests(list: { name: string; slug: string; startAt: Date }[]) {
  return list.filter((c) => c.startAt.getTime() > Date.now()).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export async function contestQuestions(slug: string): Promise<{ title: string; url: string }[]> {
  const q = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query: `{ contest(titleSlug: "${slug}") { title questions { title titleSlug } } }` }),
    signal: AbortSignal.timeout(15000),
  } as any);
  if (!q.ok) throw new Error(`leetcode questions ${q.status}`);
  const qj = (await q.json()) as any;
  return ((qj?.data?.contest?.questions as any[]) || []).map((x) => ({
    title: x.title as string,
    url: `https://leetcode.com/problems/${x.titleSlug}/`,
  }));
}

// Last (ho chuka) contest + uske 4 problems — official GraphQL, no key
export async function lastLeetCodeContest(): Promise<ContestQuestions | null> {
  const past = pastContests(await allLeetCodeContests());
  const last = past[0];
  if (!last) return null;
  const qs = await contestQuestions(last.slug);
  return { name: last.name, startAt: last.startAt, questions: qs };
}

export function formatIST(d: Date): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
