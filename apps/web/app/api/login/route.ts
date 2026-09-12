import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (body.password && body.password === process.env.DASHBOARD_PASSWORD) {
    cookies().set("pa_auth", "1", { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "wrong password" }, { status: 401 });
}
