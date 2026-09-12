"use client";
import { useEffect, useState } from "react";

type QrResp = { status: string; qr: string | null; dataUrl: string | null };
type Reminder = { id: string; title: string; remindAt: string; sent: boolean; source: string };
type Contest = { name: string; startAt: string; startIST: string; url: string } | null;

export default function Dashboard() {
  const [data, setData] = useState<QrResp | null>(null);
  const [to, setTo] = useState("917761815151");
  const [text, setText] = useState("Hello! Agent test message");
  const [msg, setMsg] = useState("");
  const [rems, setRems] = useState<Reminder[]>([]);
  const [contest, setContest] = useState<Contest>(null);

  async function load() {
    try {
      const r = await fetch("/api/agent-qr");
      if (r.ok) setData((await r.json()) as QrResp);
      const r2 = await fetch("/api/agent-reminders");
      if (r2.ok) {
        const j = (await r2.json()) as { reminders?: Reminder[] };
        setRems(j.reminders ?? []);
      }
      const r3 = await fetch("/api/agent-leetcode");
      if (r3.ok) setContest(((await r3.json()) as { contest: Contest }).contest);
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

  const [resetting, setResetting] = useState(false);
  async function newQr() {
    setResetting(true);
    await fetch("/api/agent-reset", { method: "POST" });
    setTimeout(() => {
      setResetting(false);
      load();
    }, 6000);
  }

  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairErr, setPairErr] = useState("");
  const [pairLoading, setPairLoading] = useState(false);
  async function getPairCode() {
    setPairLoading(true);
    setPairErr("");
    try {
      const r = await fetch("/api/agent-pairing", { method: "POST" });
      const j = (await r.json()) as { code?: string; error?: string };
      if (r.ok && j.code) setPairCode(j.code);
      else setPairErr(j.error || "Code nahi bana — pehle Render me AGENT_NUMBER env set karo");
    } catch {
      setPairErr("Agent se baat nahi ho payi");
    }
    setPairLoading(false);
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
      <h2>QR kaam na kare to</h2>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        “Couldn't link device” aaye to pehle WhatsApp app update karo, fir neeche dabao aur fresh QR ko 30 sec ke andar scan karo.
      </p>
      <button onClick={newQr} disabled={resetting}
        style={{ padding: "10px 16px", borderRadius: 8, cursor: "pointer" }}>
        {resetting ? "Naya QR ban raha hai..." : "Naya QR lo"}
      </button>

      <hr style={{ margin: "28px 0", opacity: 0.2 }} />
      <h2>QR se na ho to — Code se link karo</h2>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        Agent wale phone me: WhatsApp → ⋮ → Linked Devices → Link a Device → neeche
        “Link with phone number instead” → waha ye 8-digit code 1-2 min me type karo.
      </p>
      <button onClick={getPairCode} disabled={pairLoading}
        style={{ padding: "10px 16px", borderRadius: 8, cursor: "pointer" }}>
        {pairLoading ? "Code ban raha hai..." : "Pairing code lo"}
      </button>
      {pairCode && (
        <p style={{ fontSize: 32, letterSpacing: 6, fontWeight: "bold" }}>{pairCode}</p>
      )}
      {pairErr && <p style={{ color: "#ff8080" }}>{pairErr}</p>}

      <hr style={{ margin: "28px 0", opacity: 0.2 }} />
      <h2>Test message</h2>
      <input value={to} onChange={(e) => setTo(e.currentTarget.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, marginBottom: 8 }} />
      <textarea value={text} onChange={(e) => setText(e.currentTarget.value)} rows={3}
        style={{ width: "100%", padding: 10, borderRadius: 8 }} />
      <button onClick={sendTest} style={{ marginTop: 8, padding: "10px 16px", borderRadius: 8, cursor: "pointer" }}>
        Send
      </button>
      {msg && <p>{msg}</p>}

      <hr style={{ margin: "28px 0", opacity: 0.2 }} />
      <h2>Next LeetCode Contest</h2>
      {contest ? (
        <p>{contest.name} — {contest.startIST} IST</p>
      ) : (
        <p style={{ opacity: 0.7 }}>Load ho raha hai...</p>
      )}
      <p style={{ opacity: 0.7, fontSize: 13 }}>WhatsApp pe bolo: “leetcode contest se 30 min pehle remind kar”</p>

      <h2>Reminders ({rems.filter((r) => !r.sent).length} pending)</h2>
      {rems.length === 0 ? (
        <p style={{ opacity: 0.7 }}>Koi reminder nahi hai.</p>
      ) : (
        <ul>
          {rems.map((r) => (
            <li key={r.id} style={{ marginBottom: 6 }}>
              {r.sent ? "✅ " : "⏰ "}{r.title} — {new Date(r.remindAt).toLocaleString("en-IN")} [{r.source}]
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: 32, opacity: 0.6, fontSize: 13 }}>
        Owner (whitelist): 917761815151 — sirf isi ko agent reply karega.
      </p>
    </main>
  );
}
