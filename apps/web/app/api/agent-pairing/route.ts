import { NextResponse } from "next/server";

const AGENT = process.env.AGENT_BASE_URL || "http://localhost:3001";
const SECRET = process.env.AGENT_API_SECRET || "";
const h = (): Record<string, string> => (SECRET ? { "x-agent-secret": SECRET } : {});

export async function GET() {
  try {
    const r = await fetch(`${AGENT}/pairing-code`, { headers: h() });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function POST() {
  try {
    const r = await fetch(`${AGENT}/pairing-code`, { method: "POST", headers: h() });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
