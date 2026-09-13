import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import logger from "./logger.js";
dotenv.config();

const url = process.env.SUPABASE_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || "";
const pub = process.env.SUPABASE_PUBLISHABLE_KEY || "";

if (!url) logger.warn("[sb] SUPABASE_URL missing — DB features off rahenge");

// Admin client (service_role): RLS bypass, sirf backend me
export const sbAdmin = url && secret ? createClient(url, secret) : null;

// Public client: JWT validate karne ke liye
const sbPublic = url && (pub || secret) ? createClient(url, pub || secret) : null;

export function dbRequired(): boolean {
  return !!sbAdmin;
}

// Supabase Auth JWT (website login) -> user_id. Invalid pe null.
export async function authUserId(token: string): Promise<string | null> {
  if (!sbPublic || !token) return null;
  try {
    const { data, error } = await sbPublic.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
