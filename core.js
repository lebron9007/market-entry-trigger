// Market Entry Trigger — shared scoring core.
//
// The five condition rules, and the data helpers they depend on, live here
// so that the dashboard (script.js, in the browser) and the daily snapshot
// job (scripts/snapshot.mjs, in Node via GitHub Actions) score the market
// with exactly the same code. Anything that decides PASS / WATCH / FAIL
// belongs in this file.
//
// Plain script, no imports: exposes everything on globalThis.MET.
(function (root) {
"use strict";

const SECTOR_ETFS = {
  "XLK":  "Technology",
  "SMH":  "Semiconductors",
  "XLF":  "Financials",
  "XLV":  "Health Care",
  "XLE":  "Energy",
  "XLY":  "Consumer Disc.",
  "XLP":  "Consumer Stap.",
  "XLI":  "Industrials",
  "XLU":  "Utilities",
  "XLB":  "Materials",
  "XLRE": "Real Estate",
  "XLC":  "Communications"
};

// Growth/cyclical sectors eligible to be the "leading sector". Must match
// GROWTH_SECTORS in scripts/backfill_history.py so live and history agree.
const GROWTH_SECTORS = new Set(["XLK", "SMH", "XLY", "XLC", "XLF", "XLI"]);

const SECTOR_CONSTITUENTS = {
  "XLK":  ["AAPL","MSFT","NVDA","AVGO","ORCL","CRM","AMD","ADBE","ACN","CSCO"],
  "SMH":  ["NVDA","TSM","AVGO","AMD","ASML","QCOM","INTC","AMAT","LRCX","KLAC"],
  "XLF":  ["JPM","V","MA","BAC","WFC","GS","MS","AXP","SPGI","BLK"],
  "XLV":  ["LLY","UNH","JNJ","MRK","ABBV","TMO","ABT","PFE","AMGN","DHR"],
  "XLE":  ["XOM","CVX","COP","EOG","SLB","MPC","PSX","OXY","VLO","WMB"],
  "XLY":  ["AMZN","TSLA","HD","MCD","BKNG","NKE","LOW","SBUX","TJX","CMG"],
  "XLP":  ["PG","COST","WMT","KO","PEP","PM","MO","MDLZ","CL","KMB"],
  "XLI":  ["GE","RTX","CAT","BA","HON","UPS","UNP","LMT","ETN","DE"],
  "XLU":  ["NEE","SO","DUK","CEG","AEP","SRE","D","EXC","PEG","XEL"],
  "XLB":  ["LIN","SHW","FCX","APD","ECL","NEM","DOW","CTVA","NUE","MLM"],
  "XLRE": ["PLD","AMT","EQIX","WELL","CCI","PSA","O","DLR","SPG","EXR"],
  "XLC":  ["META","GOOGL","NFLX","DIS","TMUS","T","VZ","EA","WBD","CHTR"]
};

// ============================================================
// Data helpers
// ============================================================
// Robustly parse common label formats: "YYYY-MM-DD", "YYYY-MM", "MM/DD/YYYY", "MM/YYYY"
function parseDateLabel(label) {
  if (typeof label !== "string") return null;
  let m;
  if ((m = label.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/))) {
    return { y: m[1], m: m[2].padStart(2, "0"), d: (m[3] || "01").padStart(2, "0") };
  }
  if ((m = label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    return { y: m[3], m: m[1].padStart(2, "0"), d: m[2].padStart(2, "0") };
  }
  if ((m = label.match(/^(\d{1,2})\/(\d{4})$/))) {
    return { y: m[2], m: m[1].padStart(2, "0"), d: "01" };
  }
  return null;
}

// "2026-05-14" → "May 14, 2026"; "2026-04" → "Apr 2026"
function formatAsOf(iso) {
  if (!iso) return null;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = String(iso).match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) return String(iso);
  const mon = months[parseInt(m[2]) - 1] || "";
  return m[3] ? `${mon} ${parseInt(m[3])}, ${m[1]}` : `${mon} ${m[1]}`;
}

// "Dec 9" from "2026-12-09"
function shortDate(iso) {
  const p = parseDateLabel(iso);
  if (!p) return iso;
  const months = ["", "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(p.m)]} ${parseInt(p.d)}`;
}

const pct0 = p => `${Math.round(p * 100)}%`;

// 1448.4 -> "$1,448B" (FINRA margin debt is reported in $ billions).
function formatBillions(v, decimals = 0) {
  if (v == null || isNaN(v)) return "—";
  return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}B`;
}

// Derive 3-month % return from a 1-year price series (last ~66 trading days).
function _compute3M(prices) {
  if (!prices || prices.length < 66) return null;
  const start = prices[prices.length - 66];
  const end   = prices[prices.length - 1];
  if (!start || isNaN(start) || isNaN(end)) return null;
  return ((end - start) / start) * 100;
}

// Pick the leader from growth/cyclical sectors only. Defensive sectors
// beating a falling S&P is a risk-off rotation, not thematic leadership —
// the same candidate set scripts/backfill_history.py uses for the history.
function summarizeSectors(allRanked, spy3M) {
  const growth = allRanked.filter(s => s.growth);
  if (growth.length === 0) throw new Error("Not enough sector data");
  const top = growth[0];
  const overallTop = allRanked[0];
  return {
    topTicker: top.ticker, topName: top.name,
    absReturn3M: top.absReturn3M,
    relStrength3M: top.relStrength3M,
    spy3M,
    // Set when a defensive sector outranks the growth leader (shown, not scored).
    defensiveLeader: overallTop && !overallTop.growth ? overallTop : null,
    decisive: top.relStrength3M >= 3,   // clear outperformer vs S&P 500
    allRanked
  };
}

// Aggregate beat-rate across constituents at each reporting index (0 = most
// recent quarter, 1 = previous, ...). Returns oldest -> newest so the UI can
// show whether the sector's earnings momentum is on an upward trajectory.
function buildEarningsTrend(perTicker, depth = 6) {
  const maxLen = Math.max(0, ...perTicker.map(t => (t.history || []).length));
  const d = Math.min(depth, maxLen);
  const trend = [];
  for (let k = d - 1; k >= 0; k--) {
    let beats = 0, n = 0, label = "";
    for (const t of perTicker) {
      const q = (t.history || [])[k];
      if (q) { n++; if (q.beat) beats++; if (!label) label = q.quarter || ""; }
    }
    if (n) trend.push({ label, beatRate: beats / n, n });
  }
  return trend;
}

// Tally per-constituent earnings results (from /api/earnings) into the
// shape evalEarnings expects. `results[i]` is the API payload for
// tickers[i], or null if that ticker had no data. Missing data is NOT a
// miss: beat stays null and it is excluded from the beat rate.
function summarizeEarnings(sectorTicker, tickers, results) {
  const perTicker = [];
  let beats = 0, total = 0, upwardSum = 0, asOf = null, provider = null;
  results.forEach((v, i) => {
    const ticker = tickers[i];
    if (!v || !v.latest) {
      perTicker.push({ ticker, actual: null, estimate: null, surprise: null, beat: null, history: [] });
      return;
    }
    if (v.latest.date && (!asOf || v.latest.date > asOf)) asOf = v.latest.date;
    provider = provider || v.provider || null;
    const beat = Boolean(v.latest.beat);
    total++;
    if (beat) beats++;
    perTicker.push({
      ticker,
      actual:   v.latest.actual,
      estimate: v.latest.estimate,
      surprise: v.latest.surprise,
      beat,
      history: Array.isArray(v.history) ? v.history : []
    });
    upwardSum += (v.history || []).slice(0, 4).filter(q => q.beat).length;
  });
  if (total === 0) throw new Error("No earnings data returned for any constituent");
  return {
    sectorTicker,
    beatRate: beats / total,
    beats,
    quartersUpward: Math.round(upwardSum / Math.max(1, total)),
    sample: total,            // constituents with data
    universe: tickers.length, // constituents the rule is defined over
    asOf,
    provider,
    perTicker,
    quarterlyTrend: buildEarningsTrend(perTicker)
  };
}

// Score all five conditions. `data` has vix, fed, margin, leadingSector,
// earnings (each with source "live" or "mock"). Returns the per-condition
// results in display order plus the 0-5 score.
function scoreConditions(data) {
  const results = [
    evalVIX(data.vix),
    evalFed(data.fed),
    evalMargin(data.margin),
    evalLeading(data.leadingSector),
    evalEarnings(data.earnings)
  ];
  return { results, score: results.filter(r => r.pass).length };
}

// ============================================================
// Condition rules
// ============================================================
// Each rule returns { title, tab, pass, status, value, takeaway, rule,
// source, asOf, gauge }. `gauge` is the distance to the trigger line:
// { text, met, progress } — e.g. "5.9 above the 30 trigger"; progress is
// 0..1 toward the trigger line (1 = met), drawn as the overview bar.
const n1 = v => Math.abs(v).toFixed(1);
const clamp01 = v => Math.max(0, Math.min(1, v));

function evalVIX(d) {
  const v = d.value;
  const status = v > 30 ? "green" : v > 22 ? "yellow" : "red";
  return {
    title: "VIX Stress", tab: "vix",
    pass: status === "green", status,
    value: v.toFixed(1),
    gauge: {
      met: v > 30,
      progress: clamp01(v / 30),
      text: v > 30 ? `${n1(v - 30)} above the 30 trigger` : `${n1(30 - v)} below the 30 trigger`
    },
    takeaway: status === "green" ? "Above trigger threshold (>30); fear pricing reached." :
              status === "yellow" ? "Elevated but below the trigger threshold." :
              "Below trigger threshold; no fear pricing.",
    rule: "Trigger when VIX > 30",
    source: d.source,
    asOf: d.asOf || null
  };
}

function evalFed(d) {
  const upper = d.currentUpper ?? d.current;
  const lower = d.currentLow ?? upper;
  const midpoint = (upper + lower) / 2;

  // Primary rule (CME FedWatch method): fail only if the futures market
  // prices a rate HIKE as more likely than not at the next FOMC meeting.
  // A hold or a cut passes.
  const fw = d.fedwatch;
  if (fw && Number.isFinite(fw.pHike)) {
    const hikeLikely = fw.pHike >= 0.5;
    const status = hikeLikely ? "red" : "green";
    const ml = fw.mostLikely || {};
    const word = ml.steps > 0 ? "Hike" : ml.steps < 0 ? "Cut" : "Hold";
    return {
      title: "Next FOMC", tab: "fed",
      pass: !hikeLikely, status,
      value: `${word} ${pct0(ml.prob ?? 0)}`,
      gauge: {
        met: !hikeLikely,
        // 0% hike odds = fully clear; 50%+ = blocked. Bar shrinks as odds rise.
        progress: hikeLikely ? clamp01((1 - fw.pHike) / 0.5) * 0.99 : 1,
        text: `Hike odds ${pct0(fw.pHike)} — must stay under 50%`
      },
      takeaway: `${shortDate(fw.nextMeeting.date)} meeting: ${pct0(fw.pHike)} hike · ${pct0(fw.pHold)} hold · ${pct0(fw.pCut)} cut. ${
        hikeLikely ? "Hike priced in — fails trigger." : "No hike expected — meets trigger."}`,
      rule: "Trigger unless fed funds futures (CME FedWatch method) price a hike at the next FOMC meeting",
      source: d.source,
      asOf: fw.asOf || d.asOf || null
    };
  }
  // Fallback when futures data is unavailable: the previous dot-plot rule.
  const projVals = Object.values(d.projections || {}).filter(v => typeof v === "number");
  // Trend "not upward" = no projection meaningfully above current midpoint.
  const anyHigher = projVals.some(v => v > midpoint + 0.10);
  const anyLower  = projVals.some(v => v < midpoint - 0.10);
  const status = anyHigher ? "red" : anyLower ? "green" : "yellow";
  const rangeStr = lower !== upper
    ? `${lower.toFixed(2)}–${upper.toFixed(2)}%`
    : `${upper.toFixed(2)}%`;
  const minProj = projVals.length ? Math.min(...projVals) : midpoint;
  return {
    title: "Next FOMC", tab: "fed",
    pass: status === "green", status,
    value: rangeStr,
    takeaway: "FedWatch data unavailable; using dot plot: " + (
              status === "green" ? `signals cuts to ${minProj.toFixed(2)}%.` :
              status === "yellow" ? "signals hold." :
              "signals hikes ahead."),
    rule: "Trigger when the dot-plot path is flat or cutting (no future-year median above current rate)",
    source: d.source,
    asOf: d.asOf || null
  };
}

function evalMargin(d) {
  // Matches the documented rule and scripts/backfill_history.py: any
  // month-over-month decrease passes. A rise under 1% is "watch" (near flat).
  const delta = d.latest - d.prior;
  const pctDelta = (delta / d.prior) * 100;
  const status = pctDelta < 0 ? "green" : pctDelta < 1 ? "yellow" : "red";
  const h = d.history || [];
  const threeAgo = h.length >= 4 ? h[h.length - 4].value : null;
  const pct3M = threeAgo ? ((d.latest - threeAgo) / threeAgo) * 100 : null;
  const sign = v => (v >= 0 ? "+" : "");
  return {
    title: "Margin Debt", tab: "margin",
    pass: status === "green", status,
    value: formatBillions(d.latest),
    gauge: {
      met: pctDelta < 0,
      // Any decline = met; a +5% rise or more = empty bar.
      progress: pctDelta < 0 ? 1 : clamp01(1 - pctDelta / 5) * 0.99,
      text: pctDelta < 0 ? `Down ${n1(pctDelta)}% — any decline meets it` : `Up ${n1(pctDelta)}% — needs a decline`
    },
    takeaway: `${sign(pctDelta)}${pctDelta.toFixed(1)}% MoM${
      pct3M != null ? `, ${sign(pct3M)}${pct3M.toFixed(1)}% over 3M` : ""}. ${
      status === "green" ? "Decreasing — meets trigger." :
      status === "yellow" ? "Roughly flat — not decreasing." :
      "Increasing — fails trigger."}`,
    rule: "Trigger when FINRA margin debt is lower than the prior month",
    source: d.source,
    asOf: d.asOf || null
  };
}

function evalLeading(d) {
  // Trigger when a sector clearly outperforms the S&P 500 (>=3pp over 3 months).
  // No runner-up comparison needed — a clear outperformer is the signal.
  const lead = d.relStrength3M;
  const status = lead >= 3 ? "green" : lead >= 1 ? "yellow" : "red";
  const fmt = v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
  const defNote = d.defensiveLeader
    ? ` ${d.defensiveLeader.ticker} (defensive) leads overall at ${fmt(d.defensiveLeader.relStrength3M)}pp.`
    : "";
  return {
    title: "Leading Sector", tab: "sectors",
    pass: status === "green", status,
    value: d.topTicker,
    gauge: {
      met: lead >= 3,
      progress: clamp01(lead / 3),
      text: lead >= 3 ? `${n1(lead - 3)}pp above the 3pp bar` : `${n1(3 - lead)}pp short of the 3pp bar`
    },
    takeaway: `${d.topName} ${fmt(lead)}pp vs SPY (3M).${defNote}`,
    rule: "Trigger when a growth sector clearly outperforms the S&P 500 (≥3pp over 3 months)",
    source: d.source,
    asOf: d.asOf || null
  };
}

function evalEarnings(d) {
  // The rule is "≥60% of the top-N constituents beat". When some constituents
  // have no data, only pass if the confirmed beats alone clear 60% of N, and
  // only fail outright if even counting every missing one as a beat can't.
  const universe = d.universe ?? d.sample;
  const beats    = d.beats ?? Math.round(d.beatRate * d.sample);
  const missing  = Math.max(0, universe - d.sample);
  const need     = Math.ceil(0.6 * universe);
  const undetermined = beats < need && beats + missing >= need && missing > 0;
  const status = beats >= need ? "green"
               : undetermined ? "yellow"
               : d.beatRate >= 0.50 ? "yellow" : "red";
  const takeaway = missing > 0
    ? `${d.sectorTicker}: ${beats} of ${d.sample} reported beat EPS; ${missing} of ${universe} have no data.${
        undetermined ? " Not enough data to confirm." : ""}`
    : `${d.sectorTicker} top-${universe}: ${beats} of ${universe} beat EPS. ${d.quartersUpward}/4 quarters trending up.`;
  return {
    title: "Earnings Profile", tab: "earnings",
    pass: status === "green", status,
    value: `${(d.beatRate * 100).toFixed(0)}%`,
    gauge: {
      met: beats >= need,
      progress: clamp01(beats / need),
      text: beats >= need
        ? `${beats} beats, ${need} needed (${beats - need} to spare)`
        : `${beats} beats, ${need} needed (${need - beats} short${missing ? `, ${missing} without data` : ""})`
    },
    takeaway,
    rule: `Trigger when ≥60% of the leading sector's top-${universe} beat EPS`,
    source: d.source,
    asOf: d.asOf || null
  };
}

// ============================================================
// Score & verdict
// ============================================================
function verdictFor(score) {
  if (score === 5) return "All five conditions met. Historical base rate for positive 12-month forward returns: ~80–85%.";
  if (score === 4) return "Four conditions met. Strong setup, one short of full alignment.";
  if (score === 3) return "Three conditions met. Mixed signals — half the framework is favorable.";
  if (score === 2) return "Two conditions met. Most signals remain unfavorable.";
  if (score === 1) return "One condition met. Framework indicates a risk-on regime.";
  return "No conditions met. Framework signals caution.";
}

root.MET = {
  SECTOR_ETFS,
  GROWTH_SECTORS,
  SECTOR_CONSTITUENTS,
  formatBillions,
  formatAsOf,
  parseDateLabel,
  shortDate,
  pct0,
  _compute3M,
  summarizeSectors,
  buildEarningsTrend,
  summarizeEarnings,
  evalVIX,
  evalFed,
  evalMargin,
  evalLeading,
  evalEarnings,
  verdictFor,
  scoreConditions
};
})(typeof globalThis !== "undefined" ? globalThis : this);
