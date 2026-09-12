import { NextResponse } from "next/server";

const AGENT = process.env.AGENT_BASE_URL || "http://localhost:3001";
const SECRET = process.env.AGENT_API_SECRET || "";
const headers = SECRET ? { "x-agent-secret": SECRET } : {};

export async function GET() {
  try {
    const r = await fetch(`${AGENT}/reminders`, { headers, cache: "no-store" });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ reminders: [], error: (e as Error).message }, { status: 502 });
  }
}
