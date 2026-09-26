import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabaseAdmin, clientIp } from "../../../../lib/admin";

// Naya device (logged-out): one-time login ticket + QR. 2-min expiry, single-use.
// Rate-limit: 10/min per IP (best-effort, per instance memory).

const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 10;
}

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (throttled(ip)) return NextResponse.json({ error: "bahut requests — 1 min ruko" }, { status: 429 });
    const body = await req.json().catch(() => ({} as any));
    const label = String(body?.label || "").slice(0, 120);
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("LoginTicket")
      .insert({ device_label: label, ip })
      .select("id,expires_at")
      .single();
    if (error || !data) throw error || new Error("ticket nahi bana");
    const row = data as any;
    const payload = JSON.stringify({ v: 1, ticket: row.id });
    const qr = await QRCode.toDataURL(payload, { width: 240, margin: 2 });
    return NextResponse.json({ id: row.id, qr, expiresAt: row.expires_at });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (/SUPABASE_SECRET_KEY/.test(msg)) return NextResponse.json({ error: msg }, { status: 503 });
    return NextResponse.json({ error: "ticket nahi bana — fir try karo" }, { status: 500 });
  }
}

// Purana device (logged-in, scanner): ticket info — approve screen pe device dikhane ko.
// ID 128-bit unguessable hai, isliye public read safe hai (koi email/user leak nahi).
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("LoginTicket")
      .select("status,device_label,ip,expires_at")
      .eq("id", id)
      .single();
    if (!data) return NextResponse.json({ error: "ticket nahi mila" }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "fail" }, { status: 500 });
  }
}
