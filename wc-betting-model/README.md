# ⚽ WC 2026 Quant Betting Model

Quantitative World Cup 2026 betting research tool.

**Stack:** Next.js · Vercel · Claude Sonnet API

**Model:**
- Poisson scoring model with Dixon-Coles low-score correction
- 20,000 Monte Carlo trials per match
- Kelly criterion sizing
- AI (Claude Sonnet) refreshes injury/form/edge analysis every **24 hours automatically**

---

## 🚀 Deploy to Vercel (3 steps)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "WC betting model"
gh repo create wc-betting-model --public --push
```

### 2. Import to Vercel
Go to **vercel.com/new** → Import your GitHub repo → Click Deploy.

### 3. Add API Key
In Vercel dashboard → Project Settings → Environment Variables:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (your Anthropic key) |

Redeploy after adding the key.

---

## How it works

- **`/pages/index.js`** — Full dashboard with all 72 group stage matches, filterable by date and group
- **`/pages/api/analysis.js`** — Server-side API route that:
  - Calls Claude every 24h for fresh injury/form/edge intel
  - Caches results in memory (Vercel serverless instance)
  - Falls back to base Poisson model if API unavailable
- **`/lib/model.js`** — All match data + Poisson/Monte Carlo math

## Local dev
```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run dev
# Visit http://localhost:3000
```
