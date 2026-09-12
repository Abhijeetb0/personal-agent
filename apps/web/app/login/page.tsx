"use client";
import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const sb = supabaseBrowser();
      const r = mode === "in"
        ? await sb.auth.signInWithPassword({ email, password: pw })
        : await sb.auth.signUp({ email, password: pw });
      if (r.error) throw r.error;
      window.location.href = "/dashboard";
    } catch (e: any) {
      setErr(e.message || "Login fail");
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
