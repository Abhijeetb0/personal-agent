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
          // #hash tokens (implicit) ya ?code= — client khud URL se session uthata hai.
          // Thoda wait taaki detectSessionInUrl process ho jaye.
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
