"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-browser";

// QR-approve ke baad Supabase verify karke yaha bhejta hai. Token 3 me se kisi
// 1 shape me aata hai (GoTrue version pe depend karta hai) — teeno handle karo:
//   1. ?code=            → PKCE exchange (verifier ho to)
//   2. ?token_hash=&type= → verifyOtp
//   3. #access_token=…    → browser client khud detect karta hai (server ko dikhta hi nahi,
//                           isliye ye page client-side hai — purana server route kaam nahi karta tha)
function CallbackInner() {
  const params = useSearchParams();
  const [msg, setMsg] = useState("Login ho raha… ⏳");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let dead = false;
    const fail = (d: string) => {
      if (dead) return;
      setDetail(d);
      setMsg("Login fail ho gaya — neeche Detail wala text bhejo, turant thik kar dunga.");
    };
    (async () => {
      const sb = supabaseBrowser();
      try {
        // GoTrue khud error bhejta hai (jaise link invalid/used) — use pehle dikhao
        const gErr = params.get("error");
        if (gErr) {
          fail(`gtrue-error | ${gErr} | ${params.get("error_description") || "no-desc"}`);
          return;
        }
        const tokenHash = params.get("token_hash");
        const type = params.get("type") as any;
        const code = params.get("code");
        const hasHash = typeof window !== "undefined" && window.location.hash.includes("access_token");
        if (tokenHash && type) {
          const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) {
            fail(`verifyOtp-fail | ${error.message}`);
            return;
          }
        } else {
          // #hash tokens (implicit): library ka PKCE-default auto-detect reject kar
          // sakta hai — isliye tokens nikaal ke server pe session banao (sure-shot).
          const hash = typeof window !== "undefined" ? window.location.hash : "";
          const hp = new URLSearchParams(hash.replace(/^#/, ""));
          const hErr = hp.get("error");
          if (hErr) {
            fail(`hash-error | ${hErr} | ${hp.get("error_description") || "no-desc"}`);
            return;
          }
          const access_token = hp.get("access_token");
          const refresh_token = hp.get("refresh_token");
          if (access_token && refresh_token) {
            const r = await fetch("/api/auth/hash-session", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token, refresh_token }),
            });
            const j = await r.json().catch(() => ({} as any));
            if (!r.ok) {
              fail(`hash-session-fail | ${j.error || "unknown"}`);
              return;
            }
            // Server cookies ke saath-saath client khud bhi session set kare
            // (kuch browsers fetch ke Set-Cookie ko turant apply nahi karte).
            // Direct call hai — PKCE/implicit flow-quirks se independent.
            const { error: setErr } = await sb.auth.setSession({ access_token, refresh_token });
            if (setErr) {
              fail(`client-set-fail | ${setErr.message}`);
              return;
            }
            // Dashboard bhejne se PEHLE pakka karo session dikh raha hai
            let ok = false;
            for (let i = 0; i < 10; i++) {
              const { data } = await sb.auth.getSession();
              if (data.session) { ok = true; break; }
              await new Promise((res2) => setTimeout(res2, 300));
            }
            if (!ok) {
              fail("cookie-missing | session set hua par read nahi ho raha");
              return;
            }
            // QR-fresh-login: apne device ko (re)register karo taaki purana
            // remote-logout revoked flag clear ho (same-browser login loop fix).
            try {
              const { deviceId, deviceLabel } = await import("../../../lib/device");
              await fetch("/api/devices", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: deviceId(), label: deviceLabel(), fresh: true }),
              });
            } catch {}
            if (!dead) {
              setMsg("Login ho gaya ✅ — dashboard khul raha…");
              window.location.href = "/dashboard";
              return;
            }
          }
          // Fallback: library auto-detect (purane versions / ?code= case)
          let session = null;
          for (let i = 0; i < 10; i++) {
            const { data } = await sb.auth.getSession();
            if (data.session) { session = data.session; break; }
            await new Promise((r) => setTimeout(r, 300));
          }
          if (!session) {
            fail(`no-session | code:${code ? "yes" : "no"} | hash:${hasHash ? "yes" : "no"} | token_hash:${tokenHash ? "yes" : "no"}`);
            return;
          }
        }
        if (!dead) {
          setMsg("Login ho gaya ✅ — dashboard khul raha…");
          window.location.href = "/dashboard";
        }
      } catch (e: any) {
        fail(`exception | ${String(e?.message || e)}`);
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="auth-wrap">
      <div className="card" style={{ textAlign: "center" }}>
        <p>{msg}</p>
        {detail && <p className="err" style={{ marginTop: 8, wordBreak: "break-all" }}>Detail: {detail}</p>}
        <p className="muted" style={{ marginTop: 12 }}>
          <a href="/login">← Login page</a>
        </p>
      </div>
    </main>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<main className="auth-wrap"><div className="card"><p>Login ho raha… ⏳</p></div></main>}>
      <CallbackInner />
    </Suspense>
  );
}
