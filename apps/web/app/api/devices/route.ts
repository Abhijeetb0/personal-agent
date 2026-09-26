import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/server";
import { clientIp } from "../../../lib/admin";

// UserDevice: apne logged-in browsers ki list + heartbeat + remote logout.
// RLS own-data hai — user client se kaam chalta hai (service_role nahi chahiye).
// Stale (>30 din) rows list khulne pe saaf ho jati hain.

const STALE_MS = 30 * 24 * 3600 * 1000;

async function me() {
  const sb = supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { sb, user: data.user };
}

// List (stale saaf karke, latest first)
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ error: "login required" }, { status: 401 });
  await m.sb.from("UserDevice").delete().lt("last_seen", new Date(Date.now() - STALE_MS).toISOString());
  const { data, error } = await m.sb.from("UserDevice").select("id,label,ip,revoked,last_seen,created_at").order("last_seen", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: "list fail" }, { status: 500 });
  return NextResponse.json({ devices: data || [] });
}

// Heartbeat: login + dashboard-visit pe row upsert (revoked ko KABHI overwrite nahi).
// Row revoked hai to 403 + {revoked:true} (client khud logout karega).
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ error: "login required" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.id || "").slice(0, 64);
  const label = String(body?.label || "").slice(0, 120);
  if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
  const { data: rows } = await m.sb.from("UserDevice").select("id,revoked").eq("id", id);
  const row = (rows as any[])?.[0];
  if (row) {
    if (row.revoked) return NextResponse.json({ error: "revoked", revoked: true }, { status: 403 });
    const { error } = await m.sb.from("UserDevice").update({ label, ip: clientIp(req), last_seen: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "save fail" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { error } = await m.sb.from("UserDevice").insert({ id, user_id: m.user.id, label, ip: clientIp(req) });
  if (error) return NextResponse.json({ error: "save fail" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Remote logout: dusre device ko revoke (id != ownId) / apna row delete (id == ownId).
export async function DELETE(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ error: "login required" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.id || "");
  const ownId = String(body?.ownId || "");
  if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
  if (ownId && id === ownId) {
    await m.sb.from("UserDevice").delete().eq("id", id);
  } else {
    await m.sb.from("UserDevice").update({ revoked: true }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
