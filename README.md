# Market Entry Trigger

A dashboard tracking five conditions that historically precede high-probability market entries:

1. **VIX > 30** — fear-driven dislocation
2. **No Fed hike ahead** — futures don't price a hike (≥50%) at the next FOMC meeting (CME FedWatch method)
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
| Next-FOMC odds | `/api/fedwatch`: CME FedWatch method on 30-Day Fed Funds futures (Yahoo `ZQ*.CBT`), meeting dates from the Fed's calendar page | Auto, hourly cache |
| Dot plot (context / fallback) | FRED SEP series; `data/dotplot.json` fallback | Auto, quarterly |
| FINRA margin | `/api/finra-margin` (live); `data/finra_margin.json` fallback, refreshed by a daily GitHub Action | Auto, monthly |
| Earnings | Yahoo `earningsHistory` via `/api/earnings` (no key; MarketBeat fallback) | Auto, cached 7 days |

## Local dev

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Configuration

Copy `config.example.js` → `config.js` and set:
- `USE_REAL_DATA: true` to enable live fetches
- `FRED_API_KEY` — free at https://fred.stlouisfed.org/docs/api/api_key.html

## Health monitoring (deployed)

`/api/health` probes every live data source and returns per-source status
(`200` all-ok, `503` if any degraded). A daily Vercel cron (`vercel.json`)
hits it automatically.

To get alerted when a scraper breaks, set a Vercel environment variable:
- `ALERT_WEBHOOK` — a Slack or Discord incoming-webhook URL. When the daily
  check finds a degraded source, a summary is POSTed to it. If unset, the
  endpoint still works for manual checks — just no push alert.

The FINRA fallback file is refreshed by `.github/workflows/update-finra-margin.yml`
(daily, commits only on change) using the workflow's built-in token — no
personal access token needed. Run it manually from the repo's Actions tab.
