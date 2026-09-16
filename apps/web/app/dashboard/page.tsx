"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { Brand, StatusPill, StatCard, EmptyState, SectionHeader, Skeleton, type ConnTone } from "../components/ui";
import { useLang, LangToggle } from "../components/lang";
import { tr } from "../../lib/i18n";

type Status = { status: string; connected: boolean; ownerNumber: string | null; reconnectAttempts?: number; reconnectInSec?: number | null; lastClose?: { code: unknown; detail: string; at: number } | null };
type Qr = { status: string; dataUrl: string | null };
type Reminder = { id: string; title: string; remind_at: string; sent: boolean; source: string };
type Memory = { id: string; fact: string };
type Msg = { body: string; reply: string | null; created_at: string };
type Contest = { name: string; startIST: string } | null;
type ContestFull = { name: string; startAt: string; startIST: string; url: string };

type Tab = "overview" | "connect" | "contests" | "rems" | "mem" | "chat" | "files";

const TABS: { id: Tab; icon: string }[] = [
  { id: "overview", icon: "📊" },
  { id: "connect", icon: "🔗" },
  { id: "contests", icon: "🏆" },
  { id: "rems", icon: "⏰" },
  { id: "mem", icon: "🧠" },
  { id: "chat", icon: "💬" },
  { id: "files", icon: "📁" },
];

const FILE_BUCKET = "user-files";
const MAX_FILE = 50 * 1024 * 1024; // Supabase free max
const QUOTA = 1024 * 1024 * 1024; // 1 GB free

type WFile = { name: string; size: number; created: string };

function relTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  const s = d > 0 ? `${d} din` : h > 0 ? `${h} ghante` : m > 0 ? `${m} min` : "abhi";
  return diff >= 0 ? `${s} me` : `${s} pehle`;
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [lang, setLang] = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [owner, setOwner] = useState("");
  const [ownerMsg, setOwnerMsg] = useState("");
  const [agentNum, setAgentNum] = useState("");
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairNum, setPairNum] = useState<string | null>(null);
  const [pairErr, setPairErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [rems, setRems] = useState<Reminder[]>([]);
  const [mems, setMems] = useState<Memory[]>([]);
  const [chat, setChat] = useState<Msg[]>([]);
  const [contest, setContest] = useState<Contest>(null);
  const [contests, setContests] = useState<{ upcoming: ContestFull[]; past: ContestFull[] } | null>(null);
  const [testText, setTestText] = useState("Hello! Agent test");
  const [testMsg, setTestMsg] = useState("");
  const [email, setEmail] = useState("");
  // #1 reminder composer
  const [showRemModal, setShowRemModal] = useState(false);
  const [remTitle, setRemTitle] = useState("");
  const [remWhen, setRemWhen] = useState("");
  const [remErr, setRemErr] = useState("");
  const [remSaving, setRemSaving] = useState(false);
  // #2 memory composer + inline edit
  const [memNew, setMemNew] = useState("");
  const [editingMem, setEditingMem] = useState<string | null>(null);
  const [editMemText, setEditMemText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  // #3 web chat composer
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  // mirror toggle
  const [mirror, setMirror] = useState(true);
  // #files
  const [files, setFiles] = useState<WFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [upPct, setUpPct] = useState(0);
  const [upErr, setUpErr] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (tab === "files") loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const stickBottom = useRef(true);

  // Naya message/reply aaye to neeche scroll — par sirf tab jab user pehle se neeche ho
  // (purana padh raha ho to force mat karo)
  useEffect(() => {
    const el = chatBoxRef.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [chat, chatSending, tab]);

  function onChatScroll() {
    const el = chatBoxRef.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }
  // #5 activity stats
  const [activity, setActivity] = useState<string[]>([]);
  // #7 notifications
  const [notifOn, setNotifOn] = useState(false);
  const prevConn = useRef<boolean | null>(null);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    try { if (localStorage.getItem("pa-notif") === "1") setNotifOn(true); } catch {}
  }, []);

  useEffect(() => {
    if (!notifOn || typeof Notification === "undefined" || Notification.permission !== "granted") {
      if (status) prevConn.current = status.connected;
      return;
    }
    if (prevConn.current === true && status && !status.connected) {
      try { new Notification("Personal Agent 🔌", { body: "Agent offline ho gaya — auto-reconnect chal raha hai." }); } catch {}
    }
    if (status) prevConn.current = status.connected;
    const now = Date.now();
    for (const r of rems.filter((x) => !x.sent)) {
      const ms = new Date(r.remind_at).getTime() - now;
      if (ms > 0 && ms < 5 * 60 * 1000 && !notified.current.has(r.id)) {
        notified.current.add(r.id);
        try { new Notification("⏰ Reminder nazdeek hai", { body: r.title }); } catch {}
      }
    }
  }, [status, rems, notifOn]);

  async function toggleNotif() {
    if (notifOn) {
      setNotifOn(false);
      try { localStorage.setItem("pa-notif", "0"); } catch {}
      return;
    }
    if (typeof Notification === "undefined") { flash("Is browser me notifications nahi hain"); return; }
    const p = await Notification.requestPermission();
    if (p === "granted") {
      setNotifOn(true);
      try { localStorage.setItem("pa-notif", "1"); } catch {}
      flash("🔔 Notifications on!");
    } else {
      flash("Permission nahi mili — browser settings dekho");
    }
  }

  function last7(): { label: string; count: number }[] {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ label: d.toLocaleDateString("en-IN", { weekday: "narrow" }), count: 0 });
    }
    for (const iso of activity) {
      const t = new Date(iso);
      const diff = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
      if (diff >= 0 && diff < 7) days[6 - diff]!.count += 1;
    }
    return days;
  }

  async function load() {
    try {
      const s = await fetch("/api/agent-status");
      if (s.ok) setStatus(await s.json());
      const q = await fetch("/api/agent-qr");
      if (q.ok) setQr(await q.json());
      const o = await fetch("/api/agent-owner");
      if (o.ok) {
        const j = await o.json();
        if (j.ownerNumber && !owner) setOwner(j.ownerNumber);
      }
      const l = await fetch("/api/agent-leetcode");
      if (l.ok) setContest((await l.json()).contest);
      const cl = await fetch("/api/agent-contests");
      if (cl.ok) setContests(await cl.json());
      const mi = await fetch("/api/agent-mirror");
      if (mi.ok) {
        const mj = await mi.json();
        if (typeof mj.mirror === "boolean") setMirror(mj.mirror);
      }
    } catch {}
    try {
      const sb = supabaseBrowser();
      const r1 = await sb.from("Reminder").select("id,title,remind_at,sent,source").order("remind_at", { ascending: true }).limit(30);
      if (r1.data) setRems(r1.data as Reminder[]);
      const r2 = await sb.from("Memory").select("id,fact").order("created_at", { ascending: false }).limit(30);
      if (r2.data) setMems(r2.data as Memory[]);
      const r3 = await sb.from("Message").select("body,reply,created_at").order("created_at", { ascending: false }).limit(20);
      if (r3.data) setChat((r3.data as Msg[]).reverse());
      const r4 = await sb.from("Message").select("created_at").order("created_at", { ascending: false }).limit(200);
      if (r4.data) setActivity((r4.data as { created_at: string }[]).map((x) => x.created_at));
    } catch {}
  }

  useEffect(() => {
    let sb;
    try {
      sb = supabaseBrowser();
    } catch {
      window.location.href = "/login";
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = "/login";
      else {
        setEmail(data.session.user.email || "");
        load();
      }
    }).catch(() => { window.location.href = "/login"; });
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }

  async function saveOwner() {
    setOwnerMsg("save ho raha...");
    const r = await fetch("/api/agent-owner", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerNumber: owner }),
    });
    const j = await r.json();
    setOwnerMsg(r.ok ? `Saved: ${j.ownerNumber} ✅` : `Error: ${j.error}`);
    load();
  }

  async function newQr() {
    setBusy(true);
    await fetch("/api/agent-reset", { method: "POST" });
    setTimeout(() => { setBusy(false); load(); }, 6000);
  }

  async function getPairCode() {
    setBusy(true); setPairErr(""); setPairCode(null);
    try {
      const r = await fetch("/api/agent-pairing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: agentNum }),
      });
      const j = await r.json();
      if (r.ok && j.code) { setPairCode(j.code); setPairNum(j.number); }
      else setPairErr(j.error || "Code nahi bana");
    } catch { setPairErr("Agent se baat nahi hui"); }
    setBusy(false);
  }

  async function sendTest() {
    setTestMsg("bhej rahe...");
    const r = await fetch("/api/agent-send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: owner, text: testText }),
    });
    setTestMsg(r.ok ? "Bhej diya! WhatsApp dekho ✅" : "Fail — pehle connect + owner number set karo");
  }

  async function delRem(id: string) {
    await supabaseBrowser().from("Reminder").delete().eq("id", id);
    load();
  }

  async function delMem(id: string) {
    await supabaseBrowser().from("Memory").delete().eq("id", id);
    load();
  }

  function toLocalInput(d: Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  // RLS: insert me user_id explicit chahiye (policy: auth.uid() = user_id)
  async function myUserId(): Promise<string> {
    const { data } = await supabaseBrowser().auth.getUser();
    const id = data.user?.id;
    if (!id) throw new Error("Login expire ho gaya — dobara login karo");
    return id;
  }

  function openRemModal() {
    setRemTitle("");
    setRemWhen(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    setRemErr("");
    setShowRemModal(true);
  }

  async function saveReminder() {
    setRemErr("");
    const t = remTitle.trim();
    if (!t) { setRemErr("Title likho — jaise 'Dawai lena'"); return; }
    const at = new Date(remWhen);
    if (!remWhen || isNaN(at.getTime())) { setRemErr("Date + time chuno"); return; }
    if (at.getTime() <= Date.now()) { setRemErr("Future ka time chuno"); return; }
    setRemSaving(true);
    try {
      const user_id = await myUserId();
      const { error } = await supabaseBrowser().from("Reminder").insert({ user_id, title: t.slice(0, 200), remind_at: at.toISOString(), source: "web" });
      if (error) throw error;
    } catch (e: any) {
      setRemSaving(false);
      setRemErr("Save fail: " + (e.message || "pata nahi"));
      return;
    }
    setRemSaving(false);
    setShowRemModal(false);
    setRemTitle("");
    setRemWhen("");
    flash("⏰ Reminder set ho gaya!");
    load();
  }

  async function addMemory() {
    const f = memNew.trim().slice(0, 300);
    if (!f) return;
    try {
      const user_id = await myUserId();
      const { error } = await supabaseBrowser().from("Memory").insert({ user_id, fact: f });
      if (error) throw error;
    } catch {
      flash("Save fail — fir try karo");
      return;
    }
    setMemNew("");
    flash("🧠 Yaad kar liya!");
    load();
  }

  async function saveMemEdit(id: string) {
    const f = editMemText.trim().slice(0, 300);
    if (!f) return;
    const { error } = await supabaseBrowser().from("Memory").update({ fact: f }).eq("id", id);
    if (error) { flash("Edit fail — fir try karo"); return; }
    setEditingMem(null);
    flash("✏️ Update ho gaya!");
    load();
  }

  async function remindForContest(c: ContestFull) {
    const at = new Date(new Date(c.startAt).getTime() - 30 * 60 * 1000);
    if (at.getTime() <= Date.now()) { flash("Ye contest shuru ho chuka hai"); return; }
    try {
      const user_id = await myUserId();
      const { error } = await supabaseBrowser().from("Reminder").insert({
        user_id,
        title: `LeetCode: ${c.name} shuru hone wala hai`,
        remind_at: at.toISOString(),
        source: "leetcode",
      });
      if (error) throw error;
    } catch {
      flash("Reminder fail — fir try karo");
      return;
    }
    flash("🏆 Contest reminder set — 30 min pehle ping ayega!");
    load();
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatInput("");
    setChatSending(true);
    stickBottom.current = true; // bhejte hi neeche jao
    const now = new Date().toISOString();
    setChat((prev) => [...prev, { body: text, reply: null, created_at: now }]);
    try {
      const r = await fetch("/api/agent-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "fail");
      setChat((prev) => {
        const c = [...prev];
        c[c.length - 1] = { ...c[c.length - 1]!, reply: j.reply };
        return c;
      });
    } catch {
      setChat((prev) => {
        const c = [...prev];
        c[c.length - 1] = { ...c[c.length - 1]!, reply: "⚠️ " + tr(lang, "ch.err") };
        return c;
      });
    }
    setChatSending(false);
    chatInputRef.current?.focus(); // lagatar type kar sako — cursor wapas
  }

  async function toggleMirror() {
    const next = !mirror;
    setMirror(next); // optimistic
    try {
      const r = await fetch("/api/agent-mirror", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "fail");
      setMirror(!!j.mirror);
      flash(next ? "🪞 Mirror on — jawab WhatsApp pe bhi jayega!" : "🪞 Mirror off — jawab sirf web pe.");
    } catch {
      setMirror(!next); // wapas
      flash("Toggle fail — fir try karo");
    }
  }

  function fmtSize(b: number): string {
    if (!b) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  function displayName(name: string): string {
    return name.replace(/^\d+-/, "");
  }

  function fileIcon(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼";
    if (["mp4", "mov", "webm", "mkv"].includes(ext)) return "🎬";
    if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "🎵";
    if (["pdf"].includes(ext)) return "📕";
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) return "📦";
    if (["doc", "docx", "txt", "md"].includes(ext)) return "📄";
    return "📎";
  }

  async function loadFiles() {
    try {
      const sb = supabaseBrowser();
      const uid = await myUserId();
      const { data, error } = await sb.storage.from(FILE_BUCKET).list(uid, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      setFiles(
        ((data as any[]) || [])
          .filter((f) => f.name !== ".emptyFolderPlaceholder")
          .map((f) => ({ name: f.name, size: (f.metadata as any)?.size || 0, created: (f as any).created_at || "" }))
      );
    } catch {
      setFiles([]); // bucket bana hi nahi ho to khaali
    }
  }

  async function uploadFile() {
    const f = fileInputRef.current?.files?.[0];
    if (!f || uploading) return;
    if (f.size > MAX_FILE) { setUpErr("50MB se badi file nahi jayegi"); return; }
    setUploading(true);
    setUpPct(0);
    setUpErr("");
    try {
      const sb = supabaseBrowser();
      const uid = await myUserId();
      const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
      const path = `${uid}/${Date.now()}-${safe}`;
      const { data, error } = await sb.storage.from(FILE_BUCKET).createSignedUploadUrl(path);
      if (error || !data?.signedUrl) throw error || new Error("signed url nahi bana");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.signedUrl);
        xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUpPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload fail " + xhr.status)));
        xhr.onerror = () => reject(new Error("network fail"));
        xhr.send(f);
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      flash("📁 Upload ho gaya!");
      await loadFiles();
    } catch (e: any) {
      setUpErr(e.message || "Upload fail");
    }
    setUploading(false);
  }

  async function downloadFile(name: string) {
    try {
      const sb = supabaseBrowser();
      const uid = await myUserId();
      const original = displayName(name);
      const { data, error } = await sb.storage.from(FILE_BUCKET).createSignedUrl(`${uid}/${name}`, 3600, { download: original });
      if (error || !data?.signedUrl) throw error || new Error("link nahi bana");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = original;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      flash("Download link nahi bana — fir try karo");
    }
  }

  async function deleteFile(name: string) {
    if (!window.confirm(`"${displayName(name)}" delete karo?`)) return;
    try {
      const uid = await myUserId();
      const { error } = await supabaseBrowser().storage.from(FILE_BUCKET).remove([`${uid}/${name}`]);
      if (error) throw error;
      flash("🗑 Delete ho gaya");
      await loadFiles();
    } catch {
      flash("Delete fail — fir try karo");
    }
  }

  // ---- derived state ----
  const connected = !!status?.connected;
  const isQr = status?.status === "qr";
  const isLoggedOut = (status?.lastClose as any)?.code === 401;
  const retrySec = status?.reconnectInSec ?? null;
  const ownerSet = !!(status?.ownerNumber || owner);
  const everChatted = chat.length > 0;
  const pending = rems.filter((r) => !r.sent);
  const todayChats = chat.filter((m) => new Date(m.created_at).toDateString() === new Date().toDateString()).length;

  let tone: ConnTone = "neutral";
  let statusText = "Loading...";
  if (connected) { tone = "ok"; statusText = "Connected"; }
  else if (isQr) { tone = "wait"; statusText = "QR ready — scan karo"; }
  else if (isLoggedOut) { tone = "bad"; statusText = "Logged out — Naya QR lo"; }
  else if (status && (status.reconnectAttempts || 0) > 0) {
    tone = "wait";
    statusText = `Jag raha hai… ${retrySec != null && retrySec > 0 ? `${retrySec}s me retry` : "retry lag raha hai"}`;
  } else if (status) { tone = "bad"; statusText = status.status; }

  const setup = [
    { done: ownerSet, title: "Owner number save karo", desc: "Jis number se tum agent se baat karoge — agent SIRF isi ko reply karega.", go: "connect" as Tab, btn: "Set karo →" },
    { done: connected, title: "WhatsApp link karo", desc: "QR scan ya pairing code se agent wala number link karo.", go: "connect" as Tab, btn: "Link karo →" },
    { done: everChatted, title: "Pehla message bhejo", desc: "Owner number se agent ko hi bhejo — turant reply ayega.", go: "chat" as Tab, btn: "Chat dekho →" },
  ];
  const setupDone = setup.filter((s) => s.done).length;

  const nav = (cls: string, itemCls: (t: Tab) => string) => (
    <>
      {TABS.map((t) => (
        <button key={t.id} className={itemCls(t.id)} onClick={() => setTab(t.id)}>
          <span>{t.icon}</span> {tr(lang, `tab.${t.id}` as "tab.overview")}
          {t.id === "rems" && pending.length > 0 && <span className="count-badge">{pending.length}</span>}
          {t.id === "mem" && mems.length > 0 && <span className="count-badge">{mems.length}</span>}
        </button>
      ))}
    </>
  );

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <span className="brand"><Brand sub="Dashboard" /></span>
          <div className="nav-links">
            <LangToggle lang={lang} onChange={setLang} />
            <button className="ghost sm" onClick={toggleNotif} title={notifOn ? "Notifications on — band karo" : "Browser notifications on karo"} style={{ padding: "8px 12px" }}>{notifOn ? "🔔" : "🔕"}</button>
            <StatusPill tone={tone}>{statusText}</StatusPill>
          </div>
        </div>
      </nav>

      <div className="topbar-mobile">
        <div className="tabs-row">
          {nav("", (t) => `side-item${tab === t ? " active" : ""}`)}
        </div>
      </div>

      <div className="dash">
        <aside className="sidebar">
          <div className="side-user">
            <span className="avatar">{(email || "?").slice(0, 1).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <b>{email || "…"}</b>
              <span>{connected ? "● online" : "○ offline"}</span>
            </div>
          </div>
          {nav("side-nav", (t) => `side-item${tab === t ? " active" : ""}`)}
          <div className="side-foot">
            <button className="side-item side-logout" onClick={logout}>{tr(lang, "nav.logout")}</button>
          </div>
        </aside>

        <main className="dash-main">
          {tab === "overview" && (
            <>
              <div className="page-head">
                <h1>{tr(lang, "ov.title")}</h1>
                <p>{tr(lang, "ov.sub")}</p>
              </div>

              <div className={`status-hero${connected ? "" : isQr || tone === "wait" ? " wait" : " dead"}`}>
                <span className={`status-dot${connected ? " ok" : tone === "wait" || isQr ? " wait" : " bad"}`} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2>{connected ? "Agent live hai ✅" : isQr ? "QR ready — scan karo 📷" : isLoggedOut ? "Logged out hai 🔌" : "Agent jag raha hai ⏳"}</h2>
                  <p>
                    {connected
                      ? `Owner number ${status?.ownerNumber || owner || "—"} se message karke test karo.`
                      : isLoggedOut
                      ? "Connect tab me “Naya QR lo” dabao aur dobara link karo."
                      : "1–2 min me live ho jayega. Page khula rakho — Naya QR tabhi lo jab 10 min se zyada dead rahe."}
                  </p>
                </div>
                {!connected && <button className="ghost sm" onClick={() => setTab("connect")}>Connect →</button>}
              </div>

              <SectionHeader title="Setup progress" right={`${setupDone}/3 complete`} />
              <div className="setup-steps">
                {setup.map((s, i) => (
                  <div key={i} className={`setup-step${s.done ? " done" : ""}`}>
                    <span className="setup-check">{s.done ? "✓" : i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <b>{s.title}</b>
                      <p>{s.desc}</p>
                      {!s.done && <button className="ghost sm" onClick={() => setTab(s.go)}>{s.btn}</button>}
                    </div>
                  </div>
                ))}
              </div>

              <SectionHeader title="Stats" right="live" />
              <div className="stat-grid">
                <StatCard label="⏰ Pending" value={String(pending.length)} hint="reminders" />
                <StatCard label="🧠 Memories" value={String(mems.length)} hint="yaad hai" />
                <StatCard label="💬 Aaj ki chat" value={String(todayChats)} hint="messages" />
                <StatCard label="🏆 Contest" value={contest ? "✓" : "…"} hint={contest ? contest.name.slice(0, 18) : "load..."} />
              </div>

              <div className="card">
                <h2>📈 Activity — pichhle 7 din</h2>
                <p className="desc">{activity.length === 0 ? "Abhi koi data nahi — baat karna shuru karo!" : `Kul ${activity.length} messages (recent 200 me se)`}</p>
                <div className="activity-bar">
                  {last7().map((d, i, arr) => {
                    const max = Math.max(1, ...arr.map((x) => x.count));
                    return <div key={i} className={`bar${d.count === 0 ? " dim" : ""}`} style={{ height: `${Math.max(6, Math.round((d.count / max) * 100))}%` }} title={`${d.count} messages`} />;
                  })}
                </div>
                <div className="activity-days">
                  {last7().map((d, i) => <span key={i}>{d.label}</span>)}
                </div>
              </div>

              {contest && (
                <div className="card">
                  <h2>🏆 Next LeetCode Contest</h2>
                  <p className="desc">{contest.name} — <b style={{ color: "var(--accent-2)" }}>{contest.startIST}</b> IST</p>
                  <p className="muted" style={{ margin: 0 }}>WhatsApp pe bolo: “contest se 30 min pehle remind kar”</p>
                </div>
              )}

              <SectionHeader title="Recent activity" right={`${chat.length} chats`} />
              {chat.length === 0 ? (
                <EmptyState icon="💤" title="Abhi koi baat nahi hui">Owner number se <b>hi</b> bhejo — yahi pe dikhega.</EmptyState>
              ) : (
                <ul className="list">
                  {chat.slice(-4).reverse().map((m, i) => (
                    <li key={i}>
                      <div className="li-head"><b>💬 {m.body.slice(0, 90)}</b></div>
                      {m.reply && <small>→ {m.reply.slice(0, 110)}</small>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "connect" && (
            <>
              <div className="page-head">
                <h1>{tr(lang, "co.title")}</h1>
                <p>{tr(lang, "co.sub")}</p>
              </div>

              <div className="card">
                <h2><span className="step-num">1</span> &nbsp;Owner number (tumhara number)</h2>
                <p className="desc">Jis number se tum agent se baat karoge — agent SIRF isi ko reply karega.</p>
                <div className="row">
                  <input value={owner} onChange={(e) => setOwner(e.currentTarget.value)} placeholder="91XXXXXXXXXX" />
                  <button onClick={saveOwner}>Save</button>
                </div>
                {ownerMsg && <p className={ownerMsg.startsWith("Saved") ? "ok-text" : "muted"}>{ownerMsg}</p>}
              </div>

              <div className="card">
                <h2><span className="step-num">2</span> &nbsp;WhatsApp link karo (agent wala number)</h2>
                <p className="desc">Agent wale phone me: WhatsApp → ⋮ → Linked Devices → Link a Device.</p>
                <div className="qr-box">
                  {qr?.dataUrl ? (
                    <div className="qr"><img src={qr.dataUrl} alt="QR" width={220} height={220} /></div>
                  ) : connected ? (
                    <p className="ok-text">✅ Connected hai — owner number se message karke test karo.</p>
                  ) : (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Skeleton h={220} w="220px" />
                      <p className="muted" style={{ marginTop: 10 }}>QR aa raha hai… agent jag raha hoga to 1 min lagega.</p>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <StatusPill tone={tone}>{statusText}</StatusPill>
                      <p style={{ marginTop: 12 }}>
                      <button className="ghost sm" onClick={newQr} disabled={busy}>{busy ? "Ban raha..." : tr(lang, "btn.newQr")}</button>
                    </p>
                    <p className="muted">Aadha-fasa lage to hi Naya QR dabao — warna auto-reconnect ka wait karo.</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>QR na chale to — code se link karo</h2>
                <p className="desc">Number dalo → code lo → us phone me Linked Devices → “Link with phone number instead” me 1–2 min me type karo.</p>
                <div className="row">
                  <input value={agentNum} onChange={(e) => setAgentNum(e.currentTarget.value)} placeholder="91XXXXXXXXXX (agent SIM)" inputMode="numeric" />
                  <button onClick={getPairCode} disabled={busy}>{busy ? "..." : tr(lang, "btn.pairing")}</button>
                </div>
                {pairCode && (<><p className="code">{pairCode}</p><p className="muted">Ye code <b>{pairNum}</b> ke liye hai — usi phone me type karo.</p></>)}
                {pairErr && <p className="err">{pairErr}</p>}
              </div>

              <div className="card">
                <h2>✉️ Test message</h2>
                <p className="desc">Owner number pe agent se ek message bhej ke connection verify karo.</p>
                <textarea value={testText} onChange={(e) => setTestText(e.currentTarget.value)} rows={2} maxLength={500} placeholder="Kuch likho…" />
                <p className="char-count">{testText.length}/500</p>
                <button onClick={sendTest} disabled={!testText.trim() || !owner.trim()}>{tr(lang, "btn.sendTest")}</button>
                {testMsg && <p className={testMsg.startsWith("Bhej diya") ? "ok-text" : testMsg === "bhej rahe..." ? "muted" : "err"} style={{ marginTop: 10 }}>{testMsg === "bhej rahe..." ? "⏳ " + testMsg : testMsg}</p>}
                {!owner.trim() && <p className="muted">Pehle upar owner number save karo.</p>}
              </div>

              <div className="card">
                <h2>🪞 {tr(lang, "mirror.title")}</h2>
                <p className="desc">{tr(lang, "mirror.desc")}</p>
                <div className="switch-row">
                  <button className={`switch${mirror ? " on" : ""}`} onClick={toggleMirror} aria-label="mirror toggle" />
                  <b>{mirror ? tr(lang, "mirror.on") : tr(lang, "mirror.off")}</b>
                </div>
              </div>
            </>
          )}

          {tab === "contests" && (
            <>
              <div className="page-head">
                <h1>{tr(lang, "ct.title")}</h1>
                <p>{tr(lang, "ct.sub")}</p>
              </div>
              {!contests ? (
                <div className="card"><Skeleton h={20} w="60%" /><div style={{ height: 10 }} /><Skeleton h={14} /><div style={{ height: 8 }} /><Skeleton h={14} w="80%" /></div>
              ) : (
                <>
                  {contests.upcoming.length > 0 && (
                    <div className="card">
                      <div className="contest-hero">
                        <span className="big-emoji">🏆</span>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <h2>{contests.upcoming[0]!.name}</h2>
                          <p className="desc" style={{ marginBottom: 4 }}>{contests.upcoming[0]!.startIST} IST · <b style={{ color: "var(--accent-2)" }}>{relTime(contests.upcoming[0]!.startAt)}</b></p>
                          <a href={contests.upcoming[0]!.url} target="_blank" rel="noreferrer">LeetCode pe kholo →</a>
                        </div>
                        <button onClick={() => remindForContest(contests.upcoming[0]!)}>{tr(lang, "btn.remindMe")}</button>
                      </div>
                    </div>
                  )}
                  {contests.upcoming.length > 1 && (
                    <>
                      <SectionHeader title="Aane wale" right={`${contests.upcoming.length - 1} aur`} />
                      <ul className="list">
                        {contests.upcoming.slice(1).map((c, i) => (
                          <li key={i}>
                            <div className="contest-row"><b>🗓 {c.name}</b><button className="ghost sm" onClick={() => remindForContest(c)}>{tr(lang, "btn.remindShort")}</button></div>
                            <small>{c.startIST} IST · {relTime(c.startAt)}</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {contests.upcoming.length === 0 && (
                    <EmptyState icon="🏆" title="Abhi koi upcoming contest nahi">LeetCode schedule aate hi yahi dikhega.</EmptyState>
                  )}
                  {contests.past.length > 0 && (
                    <>
                      <SectionHeader title="Ho chuke" right="practice ke liye" />
                      <ul className="list">
                        {contests.past.map((c, i) => (
                          <li key={i}>
                            <div className="contest-row"><b>✅ {c.name}</b><a href={c.url} target="_blank" rel="noreferrer">kholo →</a></div>
                            <small>{c.startIST} IST</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tab === "rems" && (
            <>
              <div className="tab-head">
                <div className="page-head">
                  <h1>{tr(lang, "re.title")}</h1>
                  <p>{tr(lang, "re.sub")}</p>
                </div>
                <button className="sm" onClick={openRemModal}>{tr(lang, "btn.new")}</button>
              </div>
              {rems.length === 0 ? (
                <EmptyState icon="⏰" title="Koi reminder nahi">WhatsApp pe bolo <b>“10 min me yaad dila dena”</b> — yahi dikhega.</EmptyState>
              ) : (
                <>
                  {pending.length > 0 && (
                    <>
                      <SectionHeader title="Pending" right={`${pending.length}`} />
                      <ul className="list">
                        {pending.map((r) => (
                          <li key={r.id}>
                            <div className="li-head"><b>⏰ {r.title}</b><a href="#" className="link-danger" onClick={(e) => { e.preventDefault(); delRem(r.id); }}>hatayo</a></div>
                            <small>{new Date(r.remind_at).toLocaleString("en-IN")} · {relTime(r.remind_at)} · {r.source}</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {rems.filter((r) => r.sent).length > 0 && (
                    <>
                      <SectionHeader title="Bhej diye" right="done" />
                      <ul className="list">
                        {rems.filter((r) => r.sent).map((r) => (
                          <li key={r.id}>
                            <div className="li-head"><b>✅ {r.title}</b></div>
                            <small>{new Date(r.remind_at).toLocaleString("en-IN")} · {r.source}</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tab === "mem" && (
            <>
              <div className="page-head">
                <h1>{tr(lang, "me.title")}</h1>
                <p>{tr(lang, "me.sub")}</p>
              </div>
              <div className="card">
                <div className="row">
                  <input value={memNew} onChange={(e) => setMemNew(e.currentTarget.value)} placeholder="Yaad rakhna: mera naam…" maxLength={300} />
                  <button onClick={addMemory} disabled={!memNew.trim()}>{tr(lang, "btn.remember")}</button>
                </div>
                {memNew.trim() && <p className="char-count">{memNew.trim().length}/300</p>}
              </div>
              {mems.length === 0 ? (
                <EmptyState icon="🧠" title="Abhi kuch yaad nahi">Bolo <b>“yaad rakhna, mera naam…”</b> — pakki memory ban jayegi.</EmptyState>
              ) : (
                <ul className="list">
                  {mems.map((m) => (
                    <li key={m.id}>
                      {editingMem === m.id ? (
                        <div className="inline-edit">
                          <textarea value={editMemText} onChange={(e) => setEditMemText(e.currentTarget.value)} rows={2} maxLength={300} />
                          <div className="row">
                            <button className="sm" onClick={() => saveMemEdit(m.id)}>{tr(lang, "btn.save")}</button>
                            <button className="ghost sm" onClick={() => setEditingMem(null)}>{tr(lang, "btn.cancel")}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="li-head"><b>🧠 {m.fact}</b><a href="#" onClick={(e) => { e.preventDefault(); setEditingMem(m.id); setEditMemText(m.fact); }}>edit</a><a href="#" className="link-danger" onClick={(e) => { e.preventDefault(); delMem(m.id); }}>bhool jao</a></div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "chat" && (
            <>
              <div className="page-head">
                <h1>{tr(lang, "ch.title")}</h1>
                <p>{tr(lang, "ch.sub")} {mirror ? tr(lang, "ch.mirrorOn") : tr(lang, "ch.mirrorOff")}</p>
              </div>
              <div className="chat-shell">
                <div className="card">
                  {chat.length === 0 && !chatSending ? (
                    <EmptyState icon="💬" title="Abhi koi baat nahi hui">Pehla <b>hi</b> bhej ke dekho!</EmptyState>
                  ) : (
                    <div className="chat" ref={chatBoxRef} onScroll={onChatScroll}>
                      {chat.map((m, i) => (
                        <div key={i} style={{ display: "contents" }}>
                          <div className="bubble u">{m.body}<small>{new Date(m.created_at).toLocaleString("en-IN")}</small></div>
                          {m.reply && <div className="bubble a">{m.reply}</div>}
                        </div>
                      ))}
                      {chatSending && <div className="bubble a typing-dots">{tr(lang, "ch.typing")}<span>.</span><span>.</span><span>.</span></div>}
                    </div>
                  )}
                </div>
                <div className="card chat-composer">
                  <div className="row">
                    <input
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                      placeholder={tr(lang, "ch.ph")}
                      maxLength={1000}
                    />
                    <button onClick={sendChat} disabled={!chatInput.trim() || chatSending}>{chatSending ? "…" : tr(lang, "ch.send")}</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "files" && (
            <>
              <div className="page-head">
                <h1>{tr(lang, "fi.title")}</h1>
                <p>{tr(lang, "fi.sub")}</p>
              </div>
              <div className="card">
                <h2>📤 {tr(lang, "fi.pick")} <span className="muted">(max 50MB)</span></h2>
                <div className="row" style={{ marginTop: 12 }}>
                  <input ref={fileInputRef} type="file" onChange={() => { setUpErr(""); setUpPct(0); }} disabled={uploading} />
                  <button onClick={uploadFile} disabled={uploading}>{uploading ? `${tr(lang, "fi.uploading")} ${upPct}%` : tr(lang, "fi.upload")}</button>
                </div>
                {uploading && <div className="progress"><div style={{ width: `${upPct}%` }} /></div>}
                {upErr && <p className="err" style={{ marginTop: 10 }}>{upErr}</p>}
              </div>
              <div className="card">
                <h2>💾 Storage</h2>
                <p className="desc">{fmtSize(files.reduce((a, f) => a + f.size, 0))} / 1 GB {tr(lang, "fi.used")}</p>
                <div className={`meter${files.reduce((a, f) => a + f.size, 0) > QUOTA * 0.8 ? " hot" : ""}`}>
                  <div style={{ width: `${Math.min(100, Math.round((files.reduce((a, f) => a + f.size, 0) / QUOTA) * 100))}%` }} />
                </div>
              </div>
              {files.length === 0 ? (
                <EmptyState icon="📁" title={tr(lang, "fi.emptyT")}>{tr(lang, "fi.emptyD")}</EmptyState>
              ) : (
                <ul className="list">
                  {files.map((f) => (
                    <li key={f.name}>
                      <div className="li-head file-row">
                        <span className="file-icon">{fileIcon(f.name)}</span>
                        <b>{displayName(f.name)}</b>
                        <span className="file-actions">
                          <a href="#" onClick={(e) => { e.preventDefault(); downloadFile(f.name); }}>{tr(lang, "fi.download")}</a>
                          <a href="#" className="link-danger" onClick={(e) => { e.preventDefault(); deleteFile(f.name); }}>{tr(lang, "fi.delete")}</a>
                        </span>
                      </div>
                      <small>{fmtSize(f.size)}{f.created ? ` · ${new Date(f.created).toLocaleString("en-IN")}` : ""}</small>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </main>
      </div>

      {showRemModal && (
        <div className="modal-backdrop" onClick={() => setShowRemModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⏰ Naya reminder</h2>
            <p className="desc">Time aane pe agent WhatsApp pe ping karega.</p>
            <label className="label" htmlFor="rem-title">Kya yaad dilana hai?</label>
            <input id="rem-title" value={remTitle} onChange={(e) => setRemTitle(e.currentTarget.value)} placeholder="Dawai lena" maxLength={200} />
            <label className="label" htmlFor="rem-when">Kab?</label>
            <div className="chips">
              <button type="button" className="chip" onClick={() => setRemWhen(toLocalInput(new Date(Date.now() + 10 * 60 * 1000)))}>10 min me</button>
              <button type="button" className="chip" onClick={() => setRemWhen(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)))}>1 ghante me</button>
              <button type="button" className="chip" onClick={() => { const d = new Date(Date.now() + 24 * 60 * 60 * 1000); d.setHours(8, 0, 0, 0); setRemWhen(toLocalInput(d)); }}>Kal subah 8 baje</button>
            </div>
            <input id="rem-when" type="datetime-local" value={remWhen} onChange={(e) => setRemWhen(e.currentTarget.value)} />
            {remErr && <p className="err">{remErr}</p>}
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowRemModal(false)}>{tr(lang, "btn.cancel")}</button>
              <button onClick={saveReminder} disabled={remSaving}>{remSaving ? "Save..." : tr(lang, "btn.setRemind")}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
