import { createClient } from "@supabase/supabase-js";

// Server-only admin client (service_role) — QR approve (generateLink) + LoginTicket access.
// RLS bypass karta hai, isliye sirf API routes me import karo, browser me KABHI nahi.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  if (!url || !secret) throw new Error("SUPABASE_SECRET_KEY set nahi hai (Vercel env dekho)");
  return createClient(url, secret);
}

// Request se client IP (rate-limit + device label ke liye)
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]!.trim() || req.headers.get("x-real-ip") || "";
  return ip.slice(0, 64);
}

// Is Vercel deployment ka public origin (magiclink redirect_to ke liye)
export function publicOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}
