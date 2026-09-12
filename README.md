# Personal Agent — WhatsApp AI (100% free stack)

Baileys (WhatsApp) + Gemini Flash + Next.js dashboard + Supabase. Sirf **owner number** ko reply karta hai.

## Tumhe kya karna hai (sirf ye 5 steps)

### 1. Supabase tables (2 min)
`supabase.com` → tumhara project → **SQL Editor** → `supabase.sql` (repo root me hai) paste → **Run**.

### 2. Env values note karo
- Supabase → Project Settings → **Data API**: `Project URL` + `publishable key` + `secret key`
- `aistudio.google.com` → Gemini API key
- Ek lambi random string socho → `AGENT_API_SECRET` (web + agent dono me same)
- Dashboard password socho → `DASHBOARD_PASSWORD`

### 3. Agent ko Render pe chalao (free)
`render.com` → New → **Web Service** → ye repo select karo.
- Build: `npm install --no-audit --no-fund && npm run build --workspace=agent`
- Start: `npm start --workspace=agent`
- Environment me ye dalo: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
  `OWNER_NUMBER=917761815151`, `AGENT_API_SECRET`, `DASHBOARD_PASSWORD` (web ke liye bhi)
- Deploy ke baad URL milega: `https://personal-agent-xxxx.onrender.com`
- **Sleep jugaad (free):** `cron-job.org` pe free account → har 5 min me
  `https://tumhara-url.onrender.com/health` ping karo, warna Render 15 min me so jayega
  aur reminder late hoga.

### 4. Website ko Vercel pe chalao (free)
`vercel.com` → New Project → ye repo → **Root Directory = `apps/web`** select karo.
Env me dalo: `AGENT_BASE_URL=https://tumhara-url.onrender.com`,
`AGENT_API_SECRET` (same), `DASHBOARD_PASSWORD`.

### 5. Connect + test
1. Website `/login` → password → `/dashboard` → QR dikhega
2. **Agent wale number** se WhatsApp → Linked Devices → Link a Device → scan
3. Status `connected` → apne owner number `917761815151` se agent ko message bhejo
4. Bolo: *“leetcode contest se 30 min pehle remind kar”* → confirm ayega → time pe reminder ayega

## Local me chalana ho to

```bash
cp .env.example .env   # values bharo, ye file commit mat karo
npm install
npm run dev:agent   # terminal 1 (http://localhost:3001)
npm run dev:web     # terminal 2 (http://localhost:3000)
```

## Free limits (pehle se pata rakho)
- Render Free 15 min idle pe sleep → cron-job.org ping lagana (step 3).
- Baileys unofficial API hai → sirf owner se baat karo, spam mat karo (ban-risk low rahega).
- Gemini free ~1500 req/day → personal use me enough.
- Permanent 24x7 chahiye to baad me Oracle Always Free VPS pe shift kar denge — code same rahega.
