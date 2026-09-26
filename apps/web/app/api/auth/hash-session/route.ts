import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// QR-login callback ka fallback: browser URL-hash se mile tokens yaha POST karo,
// server session (httpOnly cookies) banata hai. Client-side auto-detect PKCE-default
// wali library me implicit hash reject kar deta hai — ye usse independent hai.
export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  try {
    const body = await req.json().catch(() => ({} as any));
    const access_token = String(body?.access_token || "");
    const refresh_token = String(body?.refresh_token || "");
    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "tokens missing" }, { status: 400 });
    }
    const store = cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => store.getAll(),
          setAll: (toSet: { name: string; value: string; options?: any }[]) => {
            toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      }
    );
    const { error } = await sb.auth.setSession({ access_token, refresh_token });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || "fail") }, { status: 500 });
  }
}
