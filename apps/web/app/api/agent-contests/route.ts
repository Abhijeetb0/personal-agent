import { NextResponse } from "next/server";
import { agentFetch } from "../../../lib/server";

export async function GET() {
  const r = await agentFetch("/leetcode");
  return NextResponse.json(r.json, { status: r.status });
}
