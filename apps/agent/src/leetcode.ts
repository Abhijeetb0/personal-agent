// LeetCode upcoming contests — free, no key.
// Primary: kontests.net API. Fallback: null (tab reminder command error dega).

export type Contest = { name: string; startAt: Date; url: string };

export async function nextLeetCodeContest(): Promise<Contest | null> {
  try {
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
