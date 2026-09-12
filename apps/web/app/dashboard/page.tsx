"use client";
import { useEffect, useState } from "react";

type QrResp = { status: string; qr: string | null; dataUrl: string | null };

export default function Dashboard() {
  const [data, setData] = useState<QrResp | null>(null);
  const [to, setTo] = useState("917761815151");
  const [text, setText] = useState("Hello! Agent test message");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/agent-qr", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function sendTest() {
    setMsg("bhej rahe...");
    const r = await fetch("/api/agent-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, text }),
    });
    setMsg(r.ok ? "Bhej diya! WhatsApp check karo." : "Fail: pehle connect karo");
  }

  return (
    <main style={{ maxWidth: 640, margin: "4vh auto", padding: 24 }}>
      <h1>WhatsApp Connect</h1>
      <p>Status: <b>{data?.status ?? "loading..."}</b></p>

      {data?.dataUrl ? (
        <>
          <p>Apne <b>agent wale number</b> se scan karo (Linked Devices → Link a Device):</p>
          <img src={data.dataUrl} alt="WhatsApp QR" width={280} height={280}
            style={{ background: "#fff", padding: 12, borderRadius: 12 }} />
        </>
      ) : data?.status === "connected" ? (
        <p style={{ color: "#7dffa8" }}>Connected hai — ab owner number se message karke test karo.</p>
      ) : (
        <p style={{ opacity: 0.7 }}>QR ka wait ho raha hai... agent Render/local pe chal raha hona chahiye.</p>
      )}

      <hr style={{ margin: "28px 0", opacity: 0.2 }} />
      <h2>Test message</h2>
      <input value={to} onChange={(e) => setTo(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, marginBottom: 8 }} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        style={{ width: "100%", padding: 10, borderRadius: 8 }} />
      <button onClick={sendTest} style={{ marginTop: 8, padding: "10px 16px", borderRadius: 8, cursor: "pointer" }}>
        Send
      </button>
      {msg && <p>{msg}</p>}

      <p style={{ marginTop: 32, opacity: 0.6, fontSize: 13 }}>
        Owner (whitelist): 917761815151 — sirf isi ko agent reply karega.
      </p>
    </main>
  );
}
