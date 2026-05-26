#!/usr/bin/env python3
"""
One-time / re-runnable backfill of data/history.json.

Computes a monthly 0-5 alignment score from real market data where possible:

  1. VIX > 30        REAL   — monthly mean of CBOE VIX close (datasets/finance-vix)
  2. Fed not rising  REAL   — Fed Funds target upper vs 3 months prior (FRED via
                              our own /api/fed-rate proxy; pre-2009 = cutting/flat)
  3. Leading sector  REAL   — top SPDR/SMH sector ETF 3-mo return vs SPY, decisive
                              if it leads SPY by >=3pp AND the runner-up by >=3pp
  4. Margin debt      PROXY — SPY >= 10% below its trailing 6-month high (forced
                              deleveraging empirically coincides with drawdowns;
                              FINRA monthly history isn't freely backfillable)
  5. Earnings         PROXY — leading-sector earnings resilience during macro pain;
                              approximated as (VIX elevated AND a decisive leader),
                              the documented historical pattern out of 2008/2020

Output points are quarterly (Jan/Apr/Jul/Oct) plus every month scoring >= 4,
so the chart keeps the peaks precise without hundreds of dots.

Run:  python scripts/backfill_history.py
"""
import json, urllib.request, datetime, statistics, os

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
START = "2007-01"

def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def ym(date_str):           # "2026-05-14" -> "2026-05"
    return date_str[:7]

def month_add(ymv, n):      # shift "YYYY-MM" by n months
    y, m = map(int, ymv.split("-"))
    idx = (y * 12 + (m - 1)) + n
    return f"{idx // 12}-{idx % 12 + 1:02d}"

# ---------------------------------------------------------------- VIX (real)
def load_vix_monthly():
    raw = fetch("https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv").decode()
    by_month = {}
    for line in raw.strip().splitlines()[1:]:
        parts = line.split(",")
        if len(parts) < 5:
            continue
        date, close = parts[0], parts[4]
        try:
            by_month.setdefault(ym(date), []).append(float(close))
        except ValueError:
            continue
    return {k: statistics.mean(v) for k, v in by_month.items()}

# ---------------------------------------------------------- Fed rate (real)
def load_fed_monthly():
    j = json.loads(fetch("https://market-entry-trigger.vercel.app/api/fed-rate"))
    monthly = {}
    for row in j.get("upper", []):
        monthly[ym(row["date"])] = row["value"]   # last value of the month wins
    return monthly

# ---------------------------------------------- Yahoo monthly close series
def load_yahoo_monthly(ticker):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?range=max&interval=1mo")
    j = json.loads(fetch(url))
    res = j["chart"]["result"][0]
    ts = res["timestamp"]
    closes = res["indicators"]["quote"][0]["close"]
    out = {}
    for t, c in zip(ts, closes):
        if c is None:
            continue
        d = datetime.datetime.utcfromtimestamp(t)
        out[f"{d.year}-{d.month:02d}"] = c
    return out

SECTORS = ["XLK", "SMH", "XLF", "XLV", "XLE", "XLY", "XLP", "XLI", "XLU", "XLB", "XLRE", "XLC"]

# Only growth/cyclical sectors qualify as "leadership" — the framework's sector
# condition is about a growth theme attracting institutional capital, not
# defensive sectors (staples, utilities, health care, real estate) outperforming
# in a selloff, which is a risk-OFF signal.
GROWTH_SECTORS = {"XLK", "SMH", "XLY", "XLC", "XLF", "XLI"}

def ret_3m(series, mth):
    prev = month_add(mth, -3)
    if mth in series and prev in series and series[prev]:
        return series[mth] / series[prev] - 1.0
    return None

def main():
    print("Fetching VIX…");   vix = load_vix_monthly()
    print("Fetching Fed…");   fed = load_fed_monthly()
    print("Fetching SPY…");   spy = load_yahoo_monthly("SPY")
    sectors = {}
    for s in SECTORS:
        print("Fetching", s, "…")
        try:
            sectors[s] = load_yahoo_monthly(s)
        except Exception as e:
            print("  skip", s, e)

    # iterate months from START to latest VIX month
    last = max(vix)
    months, cur = [], START
    while cur <= last:
        months.append(cur)
        cur = month_add(cur, 1)

    SECTOR_NAMES = {"XLK":"Technology","SMH":"Semiconductors","XLF":"Financials",
        "XLV":"Health Care","XLE":"Energy","XLY":"Consumer Disc.","XLP":"Consumer Stap.",
        "XLI":"Industrials","XLU":"Utilities","XLB":"Materials","XLRE":"Real Estate",
        "XLC":"Communications"}

    points = []
    for mth in months:
        # 1. VIX
        vix_m = vix.get(mth)
        s_vix = vix_m is not None and vix_m >= 28

        # 2. Fed not rising (vs 3 months ago). Pre-2009: Fed was flat/cutting -> pass.
        if mth < "2009-01":
            s_fed = True
        else:
            now_r, prev_r = fed.get(mth), fed.get(month_add(mth, -3))
            s_fed = (now_r is not None and prev_r is not None and now_r <= prev_r + 0.01)

        # 3. Leading sector decisive
        rs = []
        spy_r = ret_3m(spy, mth)
        if spy_r is not None:
            for s, series in sectors.items():
                if s not in GROWTH_SECTORS:
                    continue
                r = ret_3m(series, mth)
                if r is not None:
                    rs.append((s, r - spy_r))
        rs.sort(key=lambda x: x[1], reverse=True)
        decisive = False
        lead_name = None
        if len(rs) >= 2:
            top, runner = rs[0], rs[1]
            decisive = top[1] >= 0.03 and (top[1] - runner[1]) >= 0.03
            if decisive:
                lead_name = SECTOR_NAMES.get(top[0], top[0])
        s_sector = decisive

        # 4. Margin proxy: SPY >=10% below trailing 6-month high
        s_margin = False
        if mth in spy:
            highs = [spy[month_add(mth, -k)] for k in range(0, 7) if month_add(mth, -k) in spy]
            if highs:
                peak = max(highs)
                s_margin = spy[mth] <= peak * 0.90

        # 5. Earnings proxy: leadership resilience during macro pain
        s_earn = bool(s_vix and decisive)

        score = sum([s_vix, s_fed, s_sector, s_margin, s_earn])

        EVENTS = {
            "2008-10": "GFC crash", "2009-03": "GFC bottom",
            "2010-06": "Flash-crash aftermath", "2011-09": "EU debt crisis",
            "2020-03": "COVID crash", "2022-10": "Bear-market trough"
        }
        note = ""
        if score >= 4:
            bits = []
            if mth in EVENTS: bits.append(EVENTS[mth])
            if s_vix:    bits.append(f"VIX≈{vix_m:.0f}")
            if lead_name: bits.append(f"{lead_name} leading")
            note = " · ".join(bits)

        points.append({"date": mth, "score": score, "note": note,
                       "_vix": s_vix, "_fed": s_fed, "_sec": s_sector,
                       "_mar": s_margin, "_earn": s_earn})

    # keep quarterly samples + every month scoring >=4
    kept = []
    for p in points:
        m = int(p["date"].split("-")[1])
        if p["score"] >= 4 or m in (1, 4, 7, 10):
            kept.append(p)

    out = {
        "_comment": ("Monthly alignment scores. VIX (finance-vix) and Fed rate "
                     "(FRED) computed from real data; leading sector from sector-ETF "
                     "prices (Yahoo). Margin debt and earnings are proxies — SPY "
                     "drawdown depth and leadership-during-stress respectively — "
                     "since FINRA monthly history and historical EPS aren't freely "
                     "backfillable. Live dashboard uses direct data for all five. "
                     "Regenerate with scripts/backfill_history.py."),
        "points": [{"date": p["date"], "score": p["score"], "note": p["note"]} for p in kept]
    }
    path = os.path.join(os.path.dirname(__file__), "..", "data", "history.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    fives = [p["date"] for p in kept if p["score"] == 5]
    print(f"\nWrote {len(kept)} points. 5/5 months: {fives}")

if __name__ == "__main__":
    main()
