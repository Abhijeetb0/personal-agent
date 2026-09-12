import { NextResponse } from "next/server";

const AGENT = process.env.AGENT_BASE_URL || "http://localhost:3001";
const SECRET = process.env.AGENT_API_SECRET || "";

export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${AGENT}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(SECRET ? { "x-agent-secret": SECRET } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return NextResponse.json(j, { status: r.status });
}
