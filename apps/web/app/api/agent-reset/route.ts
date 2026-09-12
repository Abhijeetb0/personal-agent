import { NextResponse } from "next/server";

const AGENT = process.env.AGENT_BASE_URL || "http://localhost:3001";
const SECRET = process.env.AGENT_API_SECRET || "";

export async function POST() {
  try {
    const h: Record<string, string> = SECRET ? { "x-agent-secret": SECRET } : {};
    const r = await fetch(`${AGENT}/reset`, { method: "POST", headers: h });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
