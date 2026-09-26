import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/admin";

// Naya device poll karta hai (har 2s): pending → approved (one-time actionLink) → consumed.
// actionLink sirf EK poll ko milta hai (atomic consume: eq(status,'approved')).

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("LoginTicket")
      .select("status,action_link,expires_at")
      .eq("id", id)
      .single();
    const row = data as any;
    if (!row) return NextResponse.json({ error: "ticket nahi mila" }, { status: 404 });
    if (row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now()) {
      await sb.from("LoginTicket").update({ status: "expired" }).eq("id", id);
      return NextResponse.json({ status: "expired" });
    }
    if (row.status === "approved" && row.action_link) {
      const link = String(row.action_link);
      const done = await sb
        .from("LoginTicket")
        .update({ status: "consumed", action_link: null })
        .eq("id", id)
        .eq("status", "approved")
        .select("id");
      if ((done.data as any[])?.length > 0) return NextResponse.json({ status: "approved", actionLink: link });
      return NextResponse.json({ status: "consumed" });
    }
    return NextResponse.json({ status: row.status });
  } catch {
    return NextResponse.json({ error: "fail" }, { status: 500 });
  }
}
