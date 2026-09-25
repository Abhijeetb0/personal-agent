# Personal Agent — WhatsApp AI (multi-user, 100% free stack)

Baileys (WhatsApp) + Groq/Gemini + Next.js + Supabase (Auth + DB).
Har user ka apna login, apna WhatsApp link, apni memory, apne reminders.

## Production setup (sirf ek baar)

### 1. Supabase (2 kaam)
1. **SQL chalao:** Dashboard → SQL Editor → `supabase-multitenant.sql` paste → Run.
   (Purani single-user tables rehne do, nayi alag banengi.)
2. **Email confirm OFF:** Authentication → Sign In/Up → **"Confirm email" OFF** karo.
   (Nahi to signup ke baad login atkega — free SMTP nahi hai.)

Keys note karo (Project Settings → Data API): `Project URL`, `publishable key`, `secret key`.

### 2. Agent → Render (free Web Service)
Repo push karte hi auto-deploy hoga. Settings verify karo:
- Build: `npm install --no-audit --no-fund && npm run build --workspace=agent`
- Start: `npm start` (root se agent start hota hai)
- Environment:
  - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`
  - `GROQ_API_KEY`, `GEMINI_API_KEY` (optional fallback)
  - `WAKE_SECRET` (lamba random hex — `/wake` pinger ka password)
  - `NODE_VERSION=20`
- **Sleep jugaad (2 pinger, dono must — website kholne ki zaroorat khatam):**
  - `cron-job.org` (free) → har 5 min `GET https://tumhara-url.onrender.com/health` (HTTP alive)
  - `UptimeRobot` (free) → har 5 min `GET https://tumhara-url.onrender.com/wake?key=TUMHARA_WAKE_SECRET` (WA socket wake + dead session reconnect)
  - Dono me 2-3 min offset rakho → max gap 2-3 min, Render 15-min sleep me jayega hi nahi.
  - Reminder 1-5 min late max aa sakta hai (cold-restart pe Baileys open time). `401 loggedOut` me dashboard se `Naya QR` hi lagega.

### 3. Website → Vercel (free)
New Project → ye repo → **Root Directory = `apps/web`**. Env:
- `AGENT_BASE_URL=https://tumhara-agent.onrender.com`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 4. Pehla user (tum)
1. Website kholo → **Signup** (email + password) → Dashboard
2. **Connect tab:** owner number save karo (jis se agent se baat karoge)
3. QR scan ya pairing-code se agent wala WhatsApp link karo
4. Owner number se agent ko `hi` bhejo → reply ayega ✅
5. Bolo: *“leetcode contest se 30 min pehle remind kar dena”*

Naye users: bas signup → owner number → apna WhatsApp link. Sabka data alag (RLS).

## Local dev

```bash
cp .env.example .env   # values bharo, commit mat karo
npm install
npm run dev:agent   # :3001 (ALLOW_NO_AUTH=1 se bina-login test)
npm run dev:web     # :3000
```

## Free limits (pata rakho)
- Render Free sleep → cron-job ping must hai.
- Baileys unofficial hai → ek user ek WhatsApp, spam nahi.
- Groq free limits generous; Gemini free ~1500 req/day backup me.
- Permanent 24x7 chahiye to baad me Oracle Always Free VPS — code same rahega.
