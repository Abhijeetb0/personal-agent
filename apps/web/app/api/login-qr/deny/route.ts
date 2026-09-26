import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/admin";
import { accessToken } from "../../../../lib/server";

// Galat scan / anjaan device → ticket deny karo (naya device ko "denied" dikhega).

export async function POST(req: Request) {
  try {
    const token = await accessToken();
    if (!token) return NextResponse.json({ error: "login required" }, { status: 401 });
    const body = await req.json().catch(() => ({} as any));
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
    const sb = supabaseAdmin();
    await sb.from("LoginTicket").update({ status: "denied" }).eq("id", id).eq("status", "pending");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "fail" }, { status: 500 });
  }
}
