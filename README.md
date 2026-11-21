# Market Entry Trigger

A dashboard tracking five conditions that historically precede high-probability market entries:

1. **VIX > 30** — fear-driven dislocation
2. **Fed Funds trend** — flat or cutting (dot-plot path ≤ current rate)
3. **Debt margin decreasing** — FINRA-reported leverage unwinding
4. **Clear leading sector** — decisive thematic outperformance vs SPY
5. **Earnings profile** — leading sector beats EPS during macro pain

When all five align, the historical hit rate is ~80-85%.

## Stack

Pure static HTML/CSS/JS — runs on GitHub Pages, Netlify, or Vercel free tier.

## Data sources

| Trigger | Source | Update |
|---|---|---|
| VIX | Yahoo `^VIX` via `/api/quotes` ([`datasets/finance-vix`](https://github.com/datasets/finance-vix) CSV fallback; freshest wins) | Auto, daily |
| Sectors / constituents | Yahoo Finance (Stooq fallback) | Auto, daily |
| Fed Funds | FRED public CSV or `data/fed.json` | Auto / FOMC days |
| Dot plot | `data/dotplot.json` | Manual, quarterly |
| FINRA margin | `data/finra_margin.json` | Manual, monthly |
| Earnings | Finnhub via `/api/earnings` (needs `FINNHUB_API_KEY` Vercel env var); MarketBeat fallback | Auto when key present |

## Local dev

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Configuration

Copy `config.example.js` → `config.js` and set:
- `USE_REAL_DATA: true` to enable live fetches
- `FRED_API_KEY` — free at https://fred.stlouisfed.org/docs/api/api_key.html
- (Finnhub's key is a Vercel env var, not a `config.js` setting — see below)

## Health monitoring (deployed)

`/api/health` probes every live data source and returns per-source status
(`200` all-ok, `503` if any degraded). A daily Vercel cron (`vercel.json`)
hits it automatically.

To get alerted when a scraper breaks, set a Vercel environment variable:
- `ALERT_WEBHOOK` — a Slack or Discord incoming-webhook URL. When the daily
  check finds a degraded source, a summary is POSTed to it. If unset, the
  endpoint still works for manual checks — just no push alert.

Earnings data uses:
- `FINNHUB_API_KEY` — free key from https://finnhub.io/register. Set it as a
  Vercel environment variable (server-side, never in `config.js`). Without it,
  `/api/earnings` falls back to MarketBeat, which currently blocks the proxy.

Server-side write-back (FINRA auto-update) uses:
- `GITHUB_TOKEN` — fine-grained PAT with Contents:write on this repo.
