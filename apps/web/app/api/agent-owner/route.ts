import { NextResponse } from "next/server";
import { agentFetch } from "../../../lib/server";

export async function GET() {
  const r = await agentFetch("/owner");
  return NextResponse.json(r.json, { status: r.status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await agentFetch("/owner", { method: "POST", body: JSON.stringify(body) });
  return NextResponse.json(r.json, { status: r.status });
}
