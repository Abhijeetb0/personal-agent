"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) window.location.href = "/dashboard";
    else setErr("Galat password");
  }
  return (
    <main style={{ maxWidth: 360, margin: "10vh auto", padding: 24 }}>
      <h1>Personal Agent</h1>
      <p style={{ opacity: 0.7 }}>Dashboard password dalo (DASHBOARD_PASSWORD)</p>
      <form onSubmit={submit}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="password"
          style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #333" }}
        />
        <button style={{ marginTop: 12, padding: "12px 18px", borderRadius: 8, cursor: "pointer" }}>
          Login
        </button>
      </form>
      {err && <p style={{ color: "#ff8080" }}>{err}</p>}
    </main>
  );
}
