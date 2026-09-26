import { NextResponse } from "next/server";
import { supabaseAdmin, publicOrigin } from "../../../../lib/admin";
import { accessToken } from "../../../../lib/server";

// Purana device (logged-in): ticket approve → approver ke email ka one-time login link.
// Link SIRF approver ke apne email ka banta hai (dusre ka account hijack impossible).

export async function POST(req: Request) {
  try {
    const token = await accessToken();
    if (!token) return NextResponse.json({ error: "login required" }, { status: 401 });
    const body = await req.json().catch(() => ({} as any));
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
    const sb = supabaseAdmin();
    const { data: me, error: meErr } = await sb.auth.getUser(token);
    if (meErr || !me?.user?.email) return NextResponse.json({ error: "login expire — dobara login karo" }, { status: 401 });
    const { data: t } = await sb.from("LoginTicket").select("status,expires_at").eq("id", id).single();
    const row = t as any;
    if (!row) return NextResponse.json({ error: "ticket nahi mila" }, { status: 404 });
    if (row.status !== "pending") return NextResponse.json({ error: `ticket ${row.status} hai` }, { status: 400 });
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await sb.from("LoginTicket").update({ status: "expired" }).eq("id", id);
      return NextResponse.json({ error: "ticket expire ho gaya" }, { status: 400 });
    }
    const redirectTo = `${publicOrigin(req)}/auth/callback`;
    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: me.user.email!,
      options: { redirectTo },
    });
    if (linkErr || !(link as any)?.properties?.action_link) {
      throw linkErr || new Error("link nahi bana");
    }
    await sb
      .from("LoginTicket")
      .update({ status: "approved", approved_by: me.user.id, action_link: (link as any).properties.action_link })
      .eq("id", id)
      .eq("status", "pending");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (/SUPABASE_SECRET_KEY/.test(msg)) return NextResponse.json({ error: msg }, { status: 503 });
    return NextResponse.json({ error: "approve fail — fir try karo" }, { status: 500 });
  }
}
