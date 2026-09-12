// LeetCode upcoming contests — free, no key.
// Primary: LeetCode official GraphQL. Fallback: kontests.net.

export type Contest = { name: string; startAt: Date; url: string };

async function fromLeetCodeOfficial(): Promise<Contest | null> {
  const r = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      query: "{ upcomingContests { title titleSlug startTime duration } }",
    }),
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
    console.error("[leetcode] official failed, trying kontests:", (e as Error).message);
  }
  try {
    return await fromKontests();
  } catch (e) {
    console.error("[leetcode] fetch failed:", (e as Error).message);
    return null;
  }
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
