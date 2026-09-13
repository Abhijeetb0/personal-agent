"use client";
import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      const sb = supabaseBrowser();
      if (mode === "in") {
        const r = await sb.auth.signInWithPassword({ email, password: pw });
        if (r.error) throw r.error;
        window.location.href = "/dashboard";
      } else {
        const r = await sb.auth.signUp({ email, password: pw });
        if (r.error) throw r.error;
        if (r.data.session) {
          // email-confirm OFF hai → turant login
          window.location.href = "/dashboard";
        } else {
          // email-confirm ON hai → user ko saaf batao
          setInfo("Signup ho gaya! ✅ Email me confirm link bheja hai — pehle use kholo, fir Login karo. (Ya admin se email-confirm OFF karwao.)");
          setMode("in");
        }
      }
    } catch (e: any) {
      const m = String(e.message || "Fail");
      if (/email not confirmed/i.test(m)) {
        setErr("Email confirm nahi hui. Pehle email ka link kholo, ya Supabase me Confirm email OFF karo (README Step 1).");
      } else if (/already registered|already exists/i.test(m)) {
        setErr("Ye email pehle se registered hai — Login karo.");
        setMode("in");
      } else {
        setErr(m);
      }
    }
    setLoading(false);
  }

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <div className="hero">
        <h1>Personal <span>Agent</span></h1>
        <p>{mode === "in" ? "Wapas welcome! Login karo." : "Naya account banao — free hai."}</p>
      </div>
      <div className="card">
        <form onSubmit={submit}>
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <input type="password" required placeholder="Password (min 6)" value={pw} onChange={(e) => setPw(e.currentTarget.value)} />
          <button disabled={loading} style={{ width: "100%" }}>{loading ? "Ruko..." : mode === "in" ? "Login" : "Signup"}</button>
        </form>
        {err && <p className="err">{err}</p>}
        {info && <p className="ok-text">{info}</p>}
        <p className="muted" style={{ marginTop: 12 }}>
          {mode === "in" ? "Account nahi hai? " : "Account hai? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "in" ? "up" : "in"); }}>
            {mode === "in" ? "Signup karo" : "Login karo"}
          </a>
        </p>
      </div>
    </main>
  );
}
