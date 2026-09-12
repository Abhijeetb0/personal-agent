import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (password && password === process.env.DASHBOARD_PASSWORD) {
    cookies().set("pa_auth", "1", { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "wrong password" }, { status: 401 });
}
