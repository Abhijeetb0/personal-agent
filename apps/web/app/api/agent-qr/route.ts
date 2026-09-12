import { NextResponse } from "next/server";

const AGENT = process.env.AGENT_BASE_URL || "http://localhost:3001";
const SECRET = process.env.AGENT_API_SECRET || "";

export async function GET() {
  try {
    const r = await fetch(`${AGENT}/qr`, {
      headers: SECRET ? { "x-agent-secret": SECRET } : {},
      cache: "no-store",
    });
    const j = await r.json();
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json(
      { status: "offline", qr: null, dataUrl: null, error: (e as Error).message },
      { status: 502 }
    );
  }
}
