import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function accessToken(): Promise<string | null> {
  const sb = supabaseServer();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

const AGENT = process.env.AGENT_BASE_URL || "http://localhost:3001";

// Agent API ko user JWT ke saath call karo
export async function agentFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  if (!token) return { status: 401, json: { error: "login required" } };
  try {
    const r = await fetch(`${AGENT}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json };
  } catch {
    return { status: 502, json: { error: "agent se baat nahi hui — Render jag raha hoga, 1 min me retry karo" } };
  }
}
