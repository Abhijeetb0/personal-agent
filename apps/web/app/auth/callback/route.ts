import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// QR-approve ke baad naya device ye link kholta hai (?code=) — session banake /dashboard.
// (lib/server ka supabaseServer setAll noop hai, isliye yaha proper cookie handling.)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const res = NextResponse.redirect(new URL(next, req.url));
  if (!code) return res;
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
  await sb.auth.exchangeCodeForSession(code).catch(() => null);
  return res;
}
