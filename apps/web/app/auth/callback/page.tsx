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

  useEffect(() => {
    let dead = false;
    (async () => {
      const sb = supabaseBrowser();
      try {
        const tokenHash = params.get("token_hash");
        const type = params.get("type") as any;
        if (tokenHash && type) {
          const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
        } else {
          // #hash tokens (implicit) ya ?code= — client khud URL se session uthata hai.
          // Thoda wait taaki detectSessionInUrl process ho jaye.
          let session = null;
          for (let i = 0; i < 10; i++) {
            const { data } = await sb.auth.getSession();
            if (data.session) { session = data.session; break; }
            await new Promise((r) => setTimeout(r, 300));
          }
          if (!session) throw new Error("session nahi bani");
        }
        if (!dead) {
          setMsg("Login ho gaya ✅ — dashboard khul raha…");
          window.location.href = "/dashboard";
        }
      } catch {
        if (!dead) setMsg("Login fail ho gaya — QR expire/link purana ho sakta hai. Naya QR banao ya password se login karo.");
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="auth-wrap">
      <div className="card" style={{ textAlign: "center" }}>
        <p>{msg}</p>
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
