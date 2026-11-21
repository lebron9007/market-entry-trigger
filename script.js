// Market Entry Trigger Dashboard
// 5 conditions checked daily. Each source falls back to mock independently.

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

// Approximate market caps in $B. Order-of-magnitude only; refresh annually.
// Source: rounded from public quotes — does not need to be precise.
const MARKET_CAPS = {
  AAPL: 3300, MSFT: 3500, NVDA: 3200, AVGO: 1100, ORCL: 750, CRM: 320, AMD: 280, ADBE: 230, ACN: 230, CSCO: 250,
  TSM: 1100, ASML: 320, QCOM: 200, INTC: 130, AMAT: 170, LRCX: 150, KLAC: 110,
  JPM: 720, V: 600, MA: 480, BAC: 360, WFC: 220, GS: 170, MS: 170, AXP: 200, SPGI: 165, BLK: 145,
  LLY: 800, UNH: 540, JNJ: 410, MRK: 320, ABBV: 320, TMO: 220, ABT: 200, PFE: 180, AMGN: 165, DHR: 195,
  XOM: 530, CVX: 290, COP: 145, EOG: 80, SLB: 65, MPC: 60, PSX: 65, OXY: 55, VLO: 50, WMB: 60,
  AMZN: 2200, TSLA: 900, HD: 410, MCD: 220, BKNG: 165, NKE: 140, LOW: 145, SBUX: 110, TJX: 145, CMG: 80,
  PG: 410, COST: 480, WMT: 760, KO: 305, PEP: 240, PM: 175, MO: 95, MDLZ: 95, CL: 85, KMB: 47,
  GE: 240, RTX: 175, CAT: 200, BA: 160, HON: 140, UPS: 135, UNP: 145, LMT: 110, ETN: 145, DE: 130,
  NEE: 175, SO: 110, DUK: 95, CEG: 90, AEP: 60, SRE: 55, D: 55, EXC: 45, PEG: 45, XEL: 45,
  LIN: 230, SHW: 80, FCX: 75, APD: 75, ECL: 70, NEM: 65, DOW: 40, CTVA: 45, NUE: 45, MLM: 40,
  PLD: 130, AMT: 105, EQIX: 90, WELL: 80, CCI: 50, PSA: 60, O: 55, DLR: 50, SPG: 60, EXR: 35,
  META: 1900, GOOGL: 2300, NFLX: 350, DIS: 200, TMUS: 280, T: 200, VZ: 195, EA: 40, WBD: 30, CHTR: 60
};

// Charts on hidden tabs are created at zero size and used to play their
// intro animation from a collapsed shape when first shown. Static is clearer.
if (window.Chart) Chart.defaults.animation = false;

// 1448.4 -> "$1,448B" (FINRA margin debt is reported in $ billions).
function formatBillions(v, decimals = 0) {
  if (v == null || isNaN(v)) return "—";
  return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}B`;
}

function formatMarketCap(cap) {
  if (cap == null || isNaN(cap)) return "—";
  if (cap >= 1000) return `$${(cap / 1000).toFixed(1)}T`;
  return `$${cap.toFixed(0)}B`;
}

// Display names for SECTOR_CONSTITUENTS tickers.
const COMPANY_NAMES = {
  AAPL: "Apple Inc",            MSFT: "Microsoft Corp",       NVDA: "NVIDIA Corp",
  AVGO: "Broadcom Inc",         ORCL: "Oracle Corp",          CRM:  "Salesforce Inc",
  AMD:  "Advanced Micro Devices", ADBE: "Adobe Inc",          ACN:  "Accenture Plc",
  CSCO: "Cisco Systems",        TSM:  "Taiwan Semiconductor", ASML: "ASML Holding",
  QCOM: "Qualcomm Inc",         INTC: "Intel Corp",           AMAT: "Applied Materials",
  LRCX: "Lam Research",         KLAC: "KLA Corp",
  JPM:  "JPMorgan Chase",       V:    "Visa Inc",             MA:   "Mastercard",
  BAC:  "Bank of America",      WFC:  "Wells Fargo",          GS:   "Goldman Sachs",
  MS:   "Morgan Stanley",       AXP:  "American Express",     SPGI: "S&P Global",
  BLK:  "BlackRock Inc",
  LLY:  "Eli Lilly",            UNH:  "UnitedHealth Group",   JNJ:  "Johnson & Johnson",
  MRK:  "Merck & Co",           ABBV: "AbbVie Inc",           TMO:  "Thermo Fisher",
  ABT:  "Abbott Labs",          PFE:  "Pfizer Inc",           AMGN: "Amgen Inc",
  DHR:  "Danaher Corp",
  XOM:  "Exxon Mobil",          CVX:  "Chevron Corp",         COP:  "ConocoPhillips",
  EOG:  "EOG Resources",        SLB:  "Schlumberger",         MPC:  "Marathon Petroleum",
  PSX:  "Phillips 66",          OXY:  "Occidental Petroleum", VLO:  "Valero Energy",
  WMB:  "Williams Cos",
  AMZN: "Amazon.com",           TSLA: "Tesla Inc",            HD:   "Home Depot",
  MCD:  "McDonald's Corp",      BKNG: "Booking Holdings",     NKE:  "Nike Inc",
  LOW:  "Lowe's Cos",           SBUX: "Starbucks Corp",       TJX:  "TJX Companies",
  CMG:  "Chipotle Mexican Grill",
  PG:   "Procter & Gamble",     COST: "Costco Wholesale",     WMT:  "Walmart Inc",
  KO:   "Coca-Cola Co",         PEP:  "PepsiCo Inc",          PM:   "Philip Morris",
  MO:   "Altria Group",         MDLZ: "Mondelez Intl",        CL:   "Colgate-Palmolive",
  KMB:  "Kimberly-Clark",
  GE:   "GE Aerospace",         RTX:  "RTX Corp",             CAT:  "Caterpillar Inc",
  BA:   "Boeing Co",            HON:  "Honeywell Intl",       UPS:  "United Parcel Service",
  UNP:  "Union Pacific",        LMT:  "Lockheed Martin",      ETN:  "Eaton Corp",
  DE:   "Deere & Co",
  NEE:  "NextEra Energy",       SO:   "Southern Co",          DUK:  "Duke Energy",
  CEG:  "Constellation Energy", AEP:  "American Electric Power", SRE: "Sempra",
  D:    "Dominion Energy",      EXC:  "Exelon Corp",          PEG:  "Public Service Enterprise",
  XEL:  "Xcel Energy",
  LIN:  "Linde Plc",            SHW:  "Sherwin-Williams",     FCX:  "Freeport-McMoRan",
  APD:  "Air Products",         ECL:  "Ecolab Inc",           NEM:  "Newmont Corp",
  DOW:  "Dow Inc",              CTVA: "Corteva Inc",          NUE:  "Nucor Corp",
  MLM:  "Martin Marietta",
  PLD:  "Prologis Inc",         AMT:  "American Tower",       EQIX: "Equinix Inc",
  WELL: "Welltower Inc",        CCI:  "Crown Castle",         PSA:  "Public Storage",
  O:    "Realty Income",        DLR:  "Digital Realty",       SPG:  "Simon Property",
  EXR:  "Extra Space Storage",
  META: "Meta Platforms",       GOOGL:"Alphabet Class A",     NFLX: "Netflix Inc",
  DIS:  "Walt Disney Co",       TMUS: "T-Mobile US",          T:    "AT&T Inc",
  VZ:   "Verizon Comm",         EA:   "Electronic Arts",      WBD:  "Warner Bros Discovery",
  CHTR: "Charter Comm"
};

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

// ----- Mock data -----
function genTradingDates(n) {
  // Last n weekday dates ending today, oldest first.
  const dates = [];
  const cursor = new Date();
  while (dates.length < n) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) dates.unshift(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
}

function genMockVIXSeries(n) {
  // Mean-reverting to ~17 with occasional spikes — looks like real VIX.
  const dates = genTradingDates(n);
  let v = 15;
  return dates.map(date => {
    v = v + (17 - v) * 0.05 + (Math.random() - 0.5) * 1.4;
    if (Math.random() < 0.012) v += Math.random() * 14;
    v = Math.max(10, Math.min(55, v));
    return { date, value: parseFloat(v.toFixed(2)) };
  });
}

function genMockFedSeries(n, target) {
  // Slow drift toward target, small daily wobble.
  const dates = genTradingDates(n);
  let v = target + 0.4;
  return dates.map(date => {
    v += (target - v) * 0.01 + (Math.random() - 0.5) * 0.04;
    return { date, value: parseFloat(v.toFixed(3)) };
  });
}

const _mockVIXHist = genMockVIXSeries(252);
const _mockFedHist = genMockFedSeries(180, 3.75);

const MOCK = {
  vix: {
    value: _mockVIXHist[_mockVIXHist.length - 1].value,
    asOf:  _mockVIXHist[_mockVIXHist.length - 1].date,
    history: _mockVIXHist,
    source: "mock"
  },
  fed: {
    current: 3.75,
    currentLow: 3.50,
    currentUpper: 3.75,
    sixMoMA: _mockFedHist.reduce((a, p) => a + p.value, 0) / _mockFedHist.length,
    projections: { "2026": 3.625, "2027": 3.125, "2028": 3.125, "long_run": 3.000 },
    dotMedianYearEnd: 3.625,
    direction: "flat-then-down",
    history: _mockFedHist,
    source: "mock"
  },
  margin: {
    asOf: "2026-03", unitsLabel: "$B",
    history: [], // filled in via fetchMargin (always loaded from JSON)
    latest: 845.2, prior: 862.1,
    source: "mock"
  },
  leadingSector: {
    ...summarizeSectors([
      { ticker: "SMH",  name: "Semiconductors", absReturn3M: 17.4, relStrength3M: 12.4 },
      { ticker: "XLK",  name: "Technology",     absReturn3M: 12.1, relStrength3M:  7.1 },
      { ticker: "XLC",  name: "Communications", absReturn3M:  9.2, relStrength3M:  4.2 },
      { ticker: "XLF",  name: "Financials",     absReturn3M:  7.8, relStrength3M:  2.8 },
      { ticker: "XLI",  name: "Industrials",    absReturn3M:  6.5, relStrength3M:  1.5 },
      { ticker: "XLY",  name: "Consumer Disc.", absReturn3M:  5.6, relStrength3M:  0.6 },
      { ticker: "XLV",  name: "Health Care",    absReturn3M:  4.3, relStrength3M: -0.7 },
      { ticker: "XLB",  name: "Materials",      absReturn3M:  3.6, relStrength3M: -1.4 },
      { ticker: "XLP",  name: "Consumer Stap.", absReturn3M:  2.4, relStrength3M: -2.6 },
      { ticker: "XLRE", name: "Real Estate",    absReturn3M:  1.8, relStrength3M: -3.2 },
      { ticker: "XLU",  name: "Utilities",      absReturn3M:  1.2, relStrength3M: -3.8 },
      { ticker: "XLE",  name: "Energy",         absReturn3M: -0.1, relStrength3M: -5.1 }
    ].map(s => ({ ...s, growth: GROWTH_SECTORS.has(s.ticker) })), 5.0),
    source: "mock"
  },
  earnings: buildMockEarnings()
};

// Synthesize a plausible earnings object (latest quarter + 6-quarter history
// per ticker) so the redesigned Earnings tab renders without live data.
function buildMockEarnings() {
  const Qs = ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"]; // oldest→newest
  // beats per quarter (oldest→newest). Column sums rise 4→6→8→8→9→9 so the
  // mock momentum strip shows a realistic upward earnings trajectory.
  const seed = [
    ["NVDA", 4.80, [1,1,1,1,1,1]], ["TSM", 1.85, [1,1,1,1,1,1]],
    ["AVGO", 1.38, [1,1,1,1,1,1]], ["AMD", 0.88, [0,1,1,1,1,1]],
    ["ASML", 5.95, [0,1,1,1,1,1]], ["QCOM", 2.85, [0,0,1,1,1,1]],
    ["INTC", 0.22, [0,0,0,0,0,0]], ["AMAT", 2.05, [1,1,1,1,1,1]],
    ["LRCX", 0.98, [0,0,1,1,1,1]], ["KLAC", 8.05, [0,0,0,0,1,1]]
  ];
  const perTicker = seed.map(([ticker, baseEst, beats]) => {
    const history = Qs.map((q, i) => {
      const est = +(baseEst * (1 + i * 0.04)).toFixed(2);
      const beat = beats[i] === 1;
      const surprise = beat ? +(2 + ((ticker.length * (i + 1)) % 7)).toFixed(1)
                            : -+(1 + ((ticker.length + i) % 5)).toFixed(1);
      const actual = +(est * (1 + surprise / 100)).toFixed(2);
      return { quarter: q, estimate: est, actual, surprise, beat };
    }).reverse(); // newest first
    const latest = history[0];
    return { ticker, actual: latest.actual, estimate: latest.estimate,
             surprise: latest.surprise, beat: latest.beat, history };
  });
  const beats = perTicker.filter(t => t.beat).length;
  return {
    sectorTicker: "SMH",
    beatRate: beats / perTicker.length,
    beats,
    quartersUpward: 3,
    sample: perTicker.length,
    universe: perTicker.length,
    perTicker,
    quarterlyTrend: buildEarningsTrend(perTicker),
    source: "mock"
  };
}

// ============================================================
// Trigger evaluators
// ============================================================
function evalVIX(d) {
  const v = d.value;
  const status = v > 30 ? "green" : v > 22 ? "yellow" : "red";
  return {
    title: "VIX Stress", tab: "vix",
    pass: status === "green", status,
    value: v.toFixed(1),
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
    title: "Fed Trend", tab: "fed",
    pass: status === "green", status,
    value: rangeStr,
    takeaway: status === "green" ? `Dot plot signals cuts to ${minProj.toFixed(2)}%.` :
              status === "yellow" ? "Dot plot signals hold." :
              "Dot plot signals hikes ahead.",
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

// "2026-05-14" → "May 14, 2026"; "2026-04" → "Apr 2026"
function formatAsOf(iso) {
  if (!iso) return null;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = String(iso).match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) return String(iso);
  const mon = months[parseInt(m[2]) - 1] || "";
  return m[3] ? `${mon} ${parseInt(m[3])}, ${m[1]}` : `${mon} ${m[1]}`;
}

// ============================================================
// Lean overview cards
// ============================================================
function renderCards(results) {
  const root = document.getElementById("cards");
  root.innerHTML = "";
  results.forEach(r => {
    const el = document.createElement("div");
    el.className = `card ${r.status}${r.source === "mock" ? " is-mock" : ""}`;
    el.dataset.tab = r.tab;
    // Freshness footer: a clear sample-data warning on mock, otherwise the
    // data's "as of" date (or "live" when it's computed from current data).
    const freshness = r.source === "mock"
      ? `<div class="card-fresh mock">⚠ Sample data — live source unavailable</div>`
      : `<div class="card-fresh live">${r.asOf ? "as of " + formatAsOf(r.asOf) : "live"}</div>`;
    el.innerHTML = `
      <div class="card-head">
        <span class="card-title">${r.title}</span>
        <span class="status-pill ${r.status}">${r.status === "green" ? "PASS" : r.status === "yellow" ? "WATCH" : "FAIL"}</span>
      </div>
      <div class="card-value">${r.value}</div>
      <div class="card-takeaway">${r.takeaway}</div>
      ${freshness}
      <div class="card-link">View details →</div>
    `;
    el.addEventListener("click", () => activateTab(r.tab));
    root.appendChild(el);
  });
}

// Short labels for the trigger pills shown next to the score number.
const PILL_LABELS = {
  vix: "VIX",
  fed: "Fed",
  margin: "Margin",
  sectors: "Sector",
  earnings: "Earnings"
};

function renderScore(score, results) {
  document.getElementById("score-number").textContent = score;

  const pillsWrap = document.getElementById("trigger-pills");
  if (pillsWrap && results) {
    pillsWrap.innerHTML = results.map(r => {
      const label = PILL_LABELS[r.tab] || r.title;
      return `<span class="trigger-pill ${r.status}"><span class="pill-dot"></span>${label}</span>`;
    }).join("");
  }

  const verdictEl = document.getElementById("verdict");
  verdictEl.textContent = verdictFor(score);
  const tier = score >= 5 ? "5" : score >= 4 ? "4" : score >= 3 ? "3" : "low";
  verdictEl.className = `verdict score-${tier}`;
}

// ============================================================
// History chart (overview)
// ============================================================
// Signal-strength palette, matching the status colours used everywhere else:
// 5/5 green (full alignment), 4/5 amber (one short), 3/5 grey, <=2 faint.
// 4/5 used to be lime, which was hard to tell apart from 5/5 green.
function colorForScore(s) {
  if (s >= 5) return "#2ea043";                  // green
  if (s >= 4) return "#d29922";                  // amber
  if (s >= 3) return "rgba(139, 148, 158, 0.85)"; // grey
  return "rgba(139, 148, 158, 0.35)";            // faint grey
}

function scoreRadius(s) {
  if (s >= 5) return 8;
  if (s >= 4) return 5;
  if (s >= 3) return 3;
  return 2;
}

// 10-year weekly SPY closes — used as the historical-alignment chart backdrop.
// 10y is short enough that the 2020 COVID crash, 2022 bear, and recent drawdowns
// each have visible drama; max range made everything look like a smooth line.
const _spyHistoryCache = {};
async function fetchSpyHistory(range = "10y") {
  const host = (typeof location !== "undefined" ? location.hostname : "") || "";
  if (host === "localhost" || host === "127.0.0.1" || host === "") return null;
  if (_spyHistoryCache[range]) return _spyHistoryCache[range];
  try {
    const r = await fetch(`/api/quotes?ticker=SPY&range=${range}&interval=1wk`);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.rows || j.rows.length < 100) return null;
    _spyHistoryCache[range] = j.rows;
    return j.rows;
  } catch (_) {
    return null;
  }
}

function nearestSpyAtDate(spyRows, targetIso) {
  // Binary-search nearest weekly close to a given month string. We trim the
  // alignment label to YYYY-MM-01 and find the closest SPY row by timestamp.
  const target = new Date(`${targetIso}-01`).getTime();
  return nearestSpyByMs(spyRows, target);
}

function nearestSpyByMs(spyRows, targetMs) {
  let lo = 0, hi = spyRows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (new Date(spyRows[mid].date).getTime() < targetMs) lo = mid + 1;
    else hi = mid;
  }
  const a = spyRows[Math.max(0, lo - 1)];
  const b = spyRows[lo];
  if (!a) return b;
  if (!b) return a;
  return Math.abs(new Date(a.date).getTime() - targetMs) <
         Math.abs(new Date(b.date).getTime() - targetMs)
    ? a : b;
}

function forwardReturn12M(spyRows, alignIso) {
  const startNearest = nearestSpyAtDate(spyRows, alignIso);
  if (!startNearest) return { start: null, end: null, pct: null, status: "missing" };
  const startMs = new Date(startNearest.date).getTime();
  const endMs = new Date(`${alignIso}-01`).getTime() + 365 * 24 * 60 * 60 * 1000;
  if (endMs > Date.now()) {
    return { start: startNearest.close, end: null, pct: null, status: "pending" };
  }
  const endNearest = nearestSpyByMs(spyRows, endMs);
  if (!endNearest) return { start: startNearest.close, end: null, pct: null, status: "missing" };
  const pct = ((endNearest.close - startNearest.close) / startNearest.close) * 100;
  return { start: startNearest.close, end: endNearest.close, pct, status: "ok" };
}

function renderAlignmentTable(data /* spyRows */) {
  const wrap = document.getElementById("history-table");
  if (!wrap) return;

  // Notable alignments only — 4/5 and 5/5. These are the moments the
  // framework actually flagged; lower scores are scanned visually on the
  // chart above. Sort newest first.
  const notable = data
    .filter(p => p.score >= 4)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const tbody = notable.map(r => {
    const scoreClass = `score-cell score-${r.score}`;
    return `
      <tr>
        <td class="mono">${r.date}</td>
        <td class="num ${scoreClass}">${r.score}/5</td>
        <td class="note">${r.note || "—"}</td>
      </tr>`;
  }).join("");

  wrap.innerHTML = notable.length === 0 ? "" : `
    <div class="history-table-scroll">
      <table class="data history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th class="num">Score</th>
            <th>Event</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
}

async function renderHistory(points, currentDate, currentScore) {
  // Build the alignment dataset (append today as a "live" point).
  const data = [...points];
  const lastIso = data[data.length - 1]?.date;
  const curIso = currentDate.slice(0, 7);
  if (lastIso !== curIso) data.push({ date: curIso, score: currentScore, note: "Today" });

  const peaks = data.filter(p => p.score === 5).map(p => p.date);
  const peakNote = peaks.length
    ? `Last 5/5 alignment: ${peaks[peaks.length - 1]}. Prior peaks: ${peaks.slice(0, -1).join(", ") || "none"}.`
    : "No 5/5 alignments in this window.";
  document.getElementById("history-note").textContent =
    `${peakNote} · Historical scores: VIX, Fed rate, and sector leadership computed from real data (CBOE VIX, FRED, sector-ETF prices). Margin debt and earnings use proxies (SPY drawdown depth; growth-leadership during stress) since FINRA monthly history and historical EPS aren't freely backfillable. The live dashboard uses direct data for all five.`;

  renderAlignmentTable(data);
  _historyData = data;
  wireHistoryRange();
  await drawHistoryChart(_historyRange);
}

// Historical Alignment chart, redrawn when the 10Y / Since-2007 toggle changes.
let _historyData = [];
let _historyRange = "10y";
let _historyChart = null;

function wireHistoryRange() {
  document.querySelectorAll("#history-range button").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.range === _historyRange) return;
      _historyRange = btn.dataset.range;
      document.querySelectorAll("#history-range button").forEach(b =>
        b.classList.toggle("active", b === btn));
      await drawHistoryChart(_historyRange);
    });
  });
}

async function drawHistoryChart(range) {
  const data = _historyData;
  const canvas = document.getElementById("history-chart");
  if (_historyChart) { _historyChart.destroy(); _historyChart = null; }

  // Pull SPY backdrop. If unavailable (local dev, proxy down), fall back to
  // the simpler score-bars chart so the panel never goes empty.
  const spyRows = await fetchSpyHistory(range);
  if (!spyRows) {
    document.getElementById("history-range")?.setAttribute("hidden", "");
    _historyChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map(p => p.date),
        datasets: [{
          label: "Triggers met",
          data: data.map(p => p.score),
          backgroundColor: data.map(p => colorForScore(p.score)),
          borderRadius: 2, barPercentage: 1.0, categoryPercentage: 0.9
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { afterLabel: (c) => data[c.dataIndex].note || "" } }
        },
        scales: {
          y: { min: 0, max: 5, ticks: { stepSize: 1, color: "#8b949e" }, grid: { color: "rgba(139,148,158,0.12)" } },
          x: { ticks: { color: "#8b949e", maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } }
        }
      }
    });
    return;
  }

  // Window: from the first alignment date (minus a quarter of padding), or
  // the start of the SPY series if that's later (10Y view).
  const firstAlignDate = new Date(`${data[0].date}-01`).getTime();
  const spyClipped = spyRows.filter(r => new Date(r.date).getTime() >= firstAlignDate - 1000 * 60 * 60 * 24 * 90);
  const spyData = spyClipped.map(r => ({ x: r.date, y: r.close }));
  const windowStart = new Date(spyClipped[0].date).getTime() - 1000 * 60 * 60 * 24 * 31;

  // Place each alignment on the SPY line at the closest weekly close. Skip
  // alignments that fall before the window — "nearest" would otherwise pile
  // them all onto the first point of the chart.
  const markers = data.map(p => {
    if (new Date(`${p.date}-01`).getTime() < windowStart) return null;
    const nearest = nearestSpyAtDate(spyClipped, p.date);
    if (!nearest) return null;
    return {
      x: nearest.date,
      y: nearest.close,
      score: p.score,
      note: p.note || "",
      alignDate: p.date
    };
  }).filter(Boolean);

  _historyChart = new Chart(canvas, {
    data: {
      datasets: [
        {
          type: "line",
          label: "SPY",
          data: spyData,
          borderColor: "rgba(88, 166, 255, 0.75)",
          backgroundColor: "rgba(88, 166, 255, 0.06)",
          borderWidth: 1.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.18,
          order: 2
        },
        {
          type: "scatter",
          label: "Alignment",
          data: markers,
          pointRadius: (ctx) => scoreRadius(ctx.raw?.score ?? 0),
          pointHoverRadius: (ctx) => scoreRadius(ctx.raw?.score ?? 0) + 2,
          pointBackgroundColor: (ctx) => colorForScore(ctx.raw?.score ?? 0),
          pointBorderColor: "rgba(13, 17, 23, 0.9)",
          pointBorderWidth: 1.5,
          showLine: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(13,17,23,0.95)",
          borderColor: "#30363d",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e6edf3",
          bodyColor: "#e6edf3",
          callbacks: {
            title: (items) => {
              const it = items[0];
              const iso = it.raw?.alignDate || it.raw?.x || it.parsed.x;
              const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
              return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
            },
            label: (item) => {
              if (item.dataset.label === "SPY") {
                return `SPY: $${item.parsed.y.toFixed(2)}`;
              }
              const score = item.raw?.score ?? 0;
              return `Alignment: ${score}/5`;
            },
            afterLabel: (item) => {
              if (item.dataset.label !== "SPY" && item.raw?.note) return item.raw.note;
              return undefined;
            }
          }
        }
      },
      scales: {
        y: {
          type: "linear",
          ticks: {
            color: "#8b949e",
            callback: (v) => `$${v}`
          },
          grid: { color: "rgba(139,148,158,0.10)" }
        },
        x: {
          type: "time",
          time: {
            unit: "year",
            tooltipFormat: "MMM yyyy",
            displayFormats: { year: "yyyy" }
          },
          ticks: { color: "#8b949e", maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          grid: { display: false }
        }
      }
    }
  });
}

// ============================================================
// Detail panels — one per criterion
// ============================================================
function statusPill(status) {
  const label = status === "green" ? "PASS" : status === "yellow" ? "WATCH" : "FAIL";
  return `<span class="status-pill ${status}">${label}</span>`;
}

function renderVIXDetail(d, evalResult) {
  const above30 = d.history.filter(p => p.value > 30).length;
  const above30Pct = d.history.length ? (above30 / d.history.length * 100).toFixed(0) : "–";
  const recent = d.history.slice(-30).map(p => p.value);
  const avg30 = recent.length ? (recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(1) : "–";
  const peak = d.history.length ? Math.max(...d.history.map(p => p.value)).toFixed(1) : "–";

  document.getElementById("vix-detail").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>VIX Stress ${statusPill(evalResult.status)}</h2>
        <div class="sub">Volatility index — measures S&P 500 option-implied fear over the next 30 days.</div>
      </div>
      <div class="updated"${d.stale ? ' style="color:#d29922"' : ""}>Last quote: ${d.asOf}${d.feed ? ` · ${d.feed}` : ""}${d.stale ? " · stale" : ""}</div>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Current</div><div class="stat-value">${d.value.toFixed(1)}</div></div>
      <div class="stat"><div class="stat-label">30-day avg</div><div class="stat-value">${avg30}</div></div>
      <div class="stat"><div class="stat-label">12-month peak</div><div class="stat-value">${peak}</div></div>
      <div class="stat"><div class="stat-label">Days &gt; 30 (1Y)</div><div class="stat-value">${above30Pct}%</div></div>
    </div>
    <div class="detail-section">
      <h3>VIX — last 12 months</h3>
      <div class="detail-chart"><canvas id="vix-chart"></canvas></div>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when VIX &gt; 30. Above 30 marks fear-driven dislocation — historically a high-probability entry window. The threshold is shown as a horizontal line on the chart.
    </div>
  `;
  drawLineChart("vix-chart", d.history.map(p => p.date), d.history.map(p => p.value), {
    color: "#58a6ff",
    valueLabel: "VIX",
    thresholds: [{ value: 30, color: "#da3633", label: "Trigger > 30" }]
  });
}

function renderFedDetail(d, evalResult) {
  const upper = d.currentUpper ?? d.current;
  const lower = d.currentLow ?? upper;
  const midpoint = (upper + lower) / 2;
  const rangeStr = lower !== upper
    ? `${lower.toFixed(2)}–${upper.toFixed(2)}%`
    : `${upper.toFixed(2)}%`;
  const projections = d.projections || {};

  const projRows = Object.keys(projections)
    .sort((a, b) => (a === "long_run" ? 1 : b === "long_run" ? -1 : a.localeCompare(b)))
    .map(k => {
      const v = projections[k];
      const delta = v - midpoint;
      const deltaStr = Math.abs(delta) < 0.05 ? "no change" :
                       (delta > 0 ? `+${(delta * 100).toFixed(0)}bps` : `${(delta * 100).toFixed(0)}bps`);
      const cls = delta < -0.05 ? "beat" : delta > 0.05 ? "miss" : "";
      const label = k === "long_run" ? "Long run" : `${k} year-end`;
      return `<tr><td>${label}</td><td class="num">${v.toFixed(2)}%</td><td class="num ${cls}">${deltaStr}</td></tr>`;
    }).join("");

  document.getElementById("fed-detail").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>Fed Trend ${statusPill(evalResult.status)}</h2>
        <div class="sub">Federal Funds target range and FOMC dot-plot projections.</div>
      </div>
      <div class="updated">Rate as of ${d.asOf || "–"}${d.rateSource ? ` · ${d.rateSource}` : ""}</div>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Current target</div><div class="stat-value">${rangeStr}</div><div class="stat-sub">FOMC range (lower–upper)</div></div>
      <div class="stat"><div class="stat-label">Midpoint</div><div class="stat-value">${midpoint.toFixed(2)}%</div></div>
      <div class="stat"><div class="stat-label">Lowest projection</div><div class="stat-value">${Math.min(...Object.values(projections)).toFixed(2)}%</div><div class="stat-sub">implied trough</div></div>
      <div class="stat"><div class="stat-label">Direction</div><div class="stat-value">${(d.direction || "").toUpperCase()}</div></div>
    </div>
    <div class="detail-section">
      <h3>Rate trajectory — actual + dot-plot projection</h3>
      <div class="detail-chart"><canvas id="fed-chart"></canvas></div>
    </div>
    <div class="detail-section">
      <h3>Dot-plot medians (${d.projSource || "FOMC SEP"})</h3>
      <table class="data">
        <thead><tr><th>Period</th><th class="num">Median</th><th class="num">vs current</th></tr></thead>
        <tbody>${projRows}</tbody>
      </table>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when the dot-plot path is flat or cutting — no future-year median sits above the current rate. ${
        evalResult.status === "green"
          ? "Cuts ahead expand financial conditions and historically support multiple expansion."
          : evalResult.status === "yellow"
          ? "Path on hold neither tightens nor loosens — neutral for risk assets."
          : "Hikes ahead tighten conditions and cap upside."
      }
    </div>
  `;
  drawFedTrajectoryChart("fed-chart", d.history, projections);
}

function drawFedTrajectoryChart(canvasId, history, projections) {
  if (!history || history.length === 0) return;
  const lastHist = history[history.length - 1];

  // Build forward projection points anchored at today's rate.
  const projPoints = [{ date: lastHist.date, value: lastHist.value }];
  const yearKeys = Object.keys(projections).filter(k => /^\d{4}$/.test(k)).sort();
  yearKeys.forEach(y => projPoints.push({ date: `${y}-12-31`, value: projections[y] }));
  if (projections.long_run !== undefined && yearKeys.length > 0) {
    const last = parseInt(yearKeys[yearKeys.length - 1]);
    projPoints.push({ date: `${last + 2}-12-31`, value: projections.long_run });
  }

  // Balance the window: past span == future span, with "today" at the
  // chart's horizontal centre. This gives the historical and projected
  // sections equal visual weight.
  const todayMs        = new Date(lastHist.date).getTime();
  const farthestProjMs = new Date(projPoints[projPoints.length - 1].date).getTime();
  const futureSpanMs   = farthestProjMs - todayMs;
  const histStartMs    = todayMs - futureSpanMs;
  const xMin           = new Date(histStartMs);
  const xMax           = new Date(farthestProjMs);

  // Trim historical data to the balanced window.
  const trimmedHistory = history.filter(
    p => new Date(p.date).getTime() >= histStartMs
  );
  // Guarantee the anchor point (last hist) is present even if filtering
  // would have excluded it at the window boundary.
  if (
    trimmedHistory.length === 0 ||
    trimmedHistory[trimmedHistory.length - 1].date !== lastHist.date
  ) {
    trimmedHistory.push(lastHist);
  }

  const allDates = [...trimmedHistory.map(p => p.date), ...projPoints.slice(1).map(p => p.date)];
  const histValues = [
    ...trimmedHistory.map(p => p.value),
    ...projPoints.slice(1).map(() => null)
  ];
  const projValues = [
    ...trimmedHistory.slice(0, -1).map(() => null),
    lastHist.value,
    ...projPoints.slice(1).map(p => p.value)
  ];

  // Inline plugin: draw a dashed vertical "Today" marker at the present
  // moment, separating past (solid) from future (dashed) sections.
  const todayMarkerPlugin = {
    id: "todayMarker",
    afterDraw: (chart) => {
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      if (!xScale || !yScale) return;
      const x = xScale.getPixelForValue(todayMs);
      if (x < xScale.left || x > xScale.right) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, yScale.top);
      ctx.lineTo(x, yScale.bottom);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(139,148,158,0.55)";
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(139,148,158,0.9)";
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = "left";
      ctx.fillText("today", x + 4, yScale.top + 12);
      ctx.restore();
    }
  };

  new Chart(document.getElementById(canvasId), {
    type: "line",
    plugins: [todayMarkerPlugin],
    data: {
      labels: allDates,
      datasets: [
        {
          label: "Actual rate (upper bound)",
          data: histValues,
          borderColor: "#58a6ff",
          backgroundColor: "rgba(88,166,255,0.10)",
          stepped: "before",
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          spanGaps: false
        },
        {
          label: "Dot-plot projection",
          data: projValues,
          borderColor: "#d29922",
          backgroundColor: "rgba(0,0,0,0)",
          borderDash: [6, 4],
          stepped: "before",
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: "#d29922",
          pointBorderColor: "#0d1117",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "end",
          labels: { color: "#8b949e", boxWidth: 14, boxHeight: 2, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: "rgba(13,17,23,0.95)",
          borderColor: "#30363d",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e6edf3",
          bodyColor: "#e6edf3",
          titleFont: { size: 12, weight: "600" },
          bodyFont: { family: "ui-monospace, SFMono-Regular, Menlo, monospace", size: 12 },
          filter: (item) => item.parsed.y !== null,
          callbacks: {
            title: (items) => {
              const v = items[0].parsed.x;
              return v ? toFullDate(new Date(v).toISOString().slice(0, 10)) : "";
            },
            label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(2)}%`
          }
        }
      },
      scales: {
        y: {
          ticks: { color: "#8b949e", callback: (v) => `${v}%` },
          grid: { color: "rgba(139,148,158,0.12)" }
        },
        x: {
          // Time scale: labels distribute by actual date, so the sparse
          // year-end projection points (12/2026, 12/2027, …) get their own
          // ticks instead of being skipped over by index-based autoSkip.
          type: "time",
          min: xMin,
          max: xMax,
          time: {
            unit: "year",
            tooltipFormat: "MMM d, yyyy",
            displayFormats: { month: "MM/yyyy", year: "yyyy" }
          },
          ticks: {
            color: "#8b949e",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8
          },
          grid: { display: false }
        }
      }
    }
  });
}

function renderMarginDetail(d, evalResult) {
  const h = d.history;
  const latest = h[h.length - 1] || { month: d.asOf, value: d.latest };
  const prior  = h[h.length - 2] || { month: "?", value: d.prior };
  const yrAgo  = h[h.length - 13];
  const peak   = h.reduce((a, b) => a.value > b.value ? a : b, h[0] || { value: 0 });
  const momPct = ((latest.value - prior.value) / prior.value * 100).toFixed(1);
  const yoyPct = yrAgo ? ((latest.value - yrAgo.value) / yrAgo.value * 100).toFixed(1) : "–";
  const threeAgo = h[h.length - 4];
  const m3Pct = threeAgo ? ((latest.value - threeAgo.value) / threeAgo.value * 100).toFixed(1) : "–";
  const fromPeakPct = peak ? ((latest.value - peak.value) / peak.value * 100).toFixed(1) : "–";

  document.getElementById("margin-detail").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>Margin Debt ${statusPill(evalResult.status)}</h2>
        <div class="sub">FINRA "Debit Balances in Customers' Securities Margin Accounts" — total leverage in the system.</div>
      </div>
      <div class="updated">As of ${latest.month}</div>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Latest</div><div class="stat-value">${formatBillions(latest.value)}</div></div>
      <div class="stat"><div class="stat-label">MoM</div><div class="stat-value">${momPct >= 0 ? "+" : ""}${momPct}%</div><div class="stat-sub">vs ${prior.month}</div></div>
      <div class="stat"><div class="stat-label">3-month</div><div class="stat-value">${m3Pct === "–" ? "–" : (m3Pct >= 0 ? "+" : "") + m3Pct + "%"}</div><div class="stat-sub">${threeAgo ? "vs " + threeAgo.month : "trend"}</div></div>
      <div class="stat"><div class="stat-label">YoY</div><div class="stat-value">${yoyPct === "–" ? "–" : (yoyPct >= 0 ? "+" : "") + yoyPct + "%"}</div></div>
      <div class="stat"><div class="stat-label">From peak</div><div class="stat-value">${fromPeakPct >= 0 ? "+" : ""}${fromPeakPct}%</div><div class="stat-sub">peak: ${formatBillions(peak.value)} (${peak.month})</div></div>
    </div>
    <div class="detail-section">
      <h3>Month-over-month change</h3>
      <p class="chart-caption">
        <span class="swatch" style="background:#2ea043"></span> decrease (de-leveraging — meets trigger)
        <span class="swatch" style="background:#6e7681; margin-left:14px"></span> increase (leverage building)
      </p>
      <div class="detail-chart"><canvas id="margin-chart"></canvas></div>
    </div>
    <div class="detail-section">
      <h3>Margin debt level</h3>
      <div class="detail-chart"><canvas id="margin-level-chart"></canvas></div>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when margin debt is lower than the prior month (a rise under 1% shows as Watch). The 3-month and YoY figures show whether a dip is real de-leveraging or a pause in a rising trend. Falling margin balances signal forced de-leveraging — investors are being squeezed out, and that capitulation is historically a contrarian buy signal.
    </div>
  `;
  // Bars encode length, so they must start at zero: chart the MoM % change
  // (the quantity the trigger actually reads) on a zero baseline, and show
  // the level separately as a line, where a non-zero axis is fine.
  const momRows = h.slice(1).map((p, i) => ({
    month: p.month,
    level: p.value,
    pct: ((p.value - h[i].value) / h[i].value) * 100
  }));
  const signed = v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  drawBarChart("margin-chart", momRows.map(r => r.month), momRows.map(r => r.pct), {
    valueLabel: "MoM change",
    format: signed,
    tickFormat: v => `${v > 0 ? "+" : ""}${v}%`,
    colorFor: v => (v < 0 ? "#2ea043" : "#6e7681"),
    hoverColorFor: v => (v < 0 ? "#3fbf57" : "#8b949e"),
    beginAtZero: true,
    afterLabel: i => `Level: ${formatBillions(momRows[i].level, 1)}`
  });
  drawLineChart("margin-level-chart", h.map(p => p.month), h.map(p => p.value), {
    valueLabel: "Margin debt",
    format: v => formatBillions(v)
  });
}

// Cache: per-session constituent YTD data so re-expanding a row is instant.
const _constituentCache = {};

function _computeReturns(rows) {
  // rows: array of { date: "YYYY-MM-DD", close: number } in chronological order.
  if (rows.length < 2) throw new Error("not enough rows");
  const oneY = ((rows[rows.length - 1].close - rows[0].close) / rows[0].close) * 100;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const ytdRows = rows.filter(r => r.date >= yearStart);
  let ytd = 0;
  if (ytdRows.length >= 2) {
    ytd = ((ytdRows[ytdRows.length - 1].close - ytdRows[0].close) / ytdRows[0].close) * 100;
  }
  return { ytd, oneY, prices: rows.map(r => r.close), lastDate: rows[rows.length - 1].date };
}

// Yahoo Finance chart API — returns split- and dividend-adjusted closes.
async function fetchYahooHistory(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&includeAdjustedClose=true`;
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`Yahoo ${ticker} HTTP ${resp.status}`);
  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${ticker} empty result`);
  const ts = result.timestamp || [];
  const adj = result.indicators?.adjclose?.[0]?.adjclose
           || result.indicators?.quote?.[0]?.close
           || [];
  if (ts.length < 2 || adj.length < 2) throw new Error(`Yahoo ${ticker} short data`);
  const rows = ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    close: adj[i]
  })).filter(r => r.close != null && !isNaN(r.close));
  const { ytd, oneY, prices, lastDate } = _computeReturns(rows);
  return { ticker, ytd, oneY, prices, lastDate, source: "yahoo" };
}

// Stooq fallback (CSV, may not be split-adjusted on every ticker).
async function fetchStooqHistory(ticker) {
  const symbol = ticker.startsWith("^") ? ticker : `${ticker}.us`;
  const resp = await fetch(`https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}&i=d`);
  if (!resp.ok) throw new Error(`Stooq ${ticker} HTTP ${resp.status}`);
  const text = await resp.text();
  const lines = text.trim().split("\n").slice(1);
  if (lines.length < 252) throw new Error(`Stooq ${ticker} short history`);
  const allRows = lines.map(l => {
    const c = l.split(",");
    return { date: c[0], close: parseFloat(c[4]) };
  }).filter(r => r.date && !isNaN(r.close));
  const oneYRows = allRows.slice(-252);
  const { ytd, oneY, prices, lastDate } = _computeReturns(oneYRows);
  return { ticker, ytd, oneY, prices, lastDate, source: "stooq" };
}

// Server-side Yahoo proxy (Vercel serverless function). No CORS, split/dividend
// adjusted, edge-cached. This is the most accurate path when the dashboard is
// deployed; in local dev it falls through immediately.
async function fetchProxyHistory(ticker) {
  // Skip the proxy on local dev — Vercel functions don't run under `python -m http.server`.
  const host = (typeof location !== "undefined" ? location.hostname : "") || "";
  if (host === "localhost" || host === "127.0.0.1" || host === "") {
    throw new Error("proxy unavailable in local dev");
  }
  const resp = await fetch(`/api/quotes?ticker=${encodeURIComponent(ticker)}&range=1y`);
  if (!resp.ok) throw new Error(`Proxy ${ticker} HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json.rows || json.rows.length < 2) throw new Error(`Proxy ${ticker} short data`);
  const { ytd, oneY, prices, lastDate } = _computeReturns(json.rows);
  return { ticker, ytd, oneY, prices, lastDate, source: "proxy" };
}

async function fetchHistoryWithFallback(ticker) {
  // Priority: serverless proxy (most accurate) → Yahoo direct (CORS hit-or-miss) → Stooq.
  try { return await fetchProxyHistory(ticker); }
  catch (e) { console.warn(`[${ticker}] Proxy failed (${e.message || e}) — trying Yahoo direct`); }
  try { return await fetchYahooHistory(ticker); }
  catch (e) { console.warn(`[${ticker}] Yahoo direct failed (${e.message || e}) — falling back to Stooq`); }
  return await fetchStooqHistory(ticker);
}

async function fetchTopMovers(sectorTicker) {
  if (_constituentCache[sectorTicker]) return _constituentCache[sectorTicker];
  const tickers = SECTOR_CONSTITUENTS[sectorTicker] || [];
  const settled = await Promise.allSettled(tickers.map(t => fetchHistoryWithFallback(t)));
  const movers = settled
    .filter(r => r.status === "fulfilled" && !isNaN(r.value.oneY))
    .map(r => r.value)
    .sort((a, b) => b.ytd - a.ytd);
  if (movers.length > 0) _constituentCache[sectorTicker] = movers;
  return movers;
}

function genMockPrices(ytd, n = 100) {
  const prices = [100];
  const dailyDrift = (ytd / 100) / n;
  for (let i = 1; i < n; i++) {
    const noise = (Math.random() - 0.5) * 0.025;
    prices.push(prices[i - 1] * (1 + dailyDrift + noise));
  }
  return prices;
}

function genMockMovers(sectorTicker, sectorGain) {
  const tickers = SECTOR_CONSTITUENTS[sectorTicker] || [];
  return tickers
    .map(t => {
      const ytd  = sectorGain + (Math.random() - 0.3) * 22;
      const oneY = ytd * 1.6 + (Math.random() - 0.3) * 28;
      return { ticker: t, ytd, oneY, prices: genMockPrices(oneY, 252) };
    })
    .sort((a, b) => b.ytd - a.ytd);
}

function sparklineSVG(prices, color, width = 200, height = 28, padLeft = 0, padRight = 0) {
  if (!prices || prices.length < 2) return "";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = (max - min) || 1;
  const drawWidth = Math.max(1, width - padLeft - padRight);
  const stepX = drawWidth / (prices.length - 1);
  const pad = 2;
  const usableH = height - pad * 2;
  const points = prices.map((p, i) => {
    const x = (padLeft + i * stepX).toFixed(1);
    const y = (pad + usableH - ((p - min) / range) * usableH).toFixed(1);
    return `${x},${y}`;
  }).join(" ");
  // Subtle area fill under the line — start/end at the same x bounds as the line itself.
  const areaPoints = `${padLeft},${height} ${points} ${width - padRight},${height}`;
  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <polyline points="${areaPoints}" fill="${color}" fill-opacity="0.12" stroke="none" />
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    </svg>`;
}

function renderSectorsDetail(d, evalResult) {
  const rows = d.allRanked.map((s, i) => {
    const cls = s.ticker === d.topTicker ? "highlight" : "";
    const tag = s.growth === false ? ` <span class="sector-tag" title="Not eligible as leader — only growth/cyclical sectors count">non-growth</span>` : "";
    const absSign = s.absReturn3M  >= 0 ? "+" : "";
    const relSign = s.relStrength3M >= 0 ? "+" : "";
    const absClass = s.absReturn3M  >= 0 ? "beat" : "miss";
    const relClass = s.relStrength3M >= 0 ? "beat" : "miss";
    return `
      <tr class="sector-row ${cls}" data-ticker="${s.ticker}">
        <td class="num">${i + 1}</td>
        <td><span class="expander">▶</span> <strong>${s.ticker}</strong></td>
        <td>${s.name}${tag}</td>
        <td class="num ${absClass}">${absSign}${s.absReturn3M.toFixed(2)}%</td>
        <td class="num ${relClass}">${relSign}${s.relStrength3M.toFixed(2)}%</td>
      </tr>
      <tr class="sector-detail-row" data-detail="${s.ticker}" hidden>
        <td colspan="5"><div class="constituents-wrap" data-content="${s.ticker}"></div></td>
      </tr>`;
  }).join("");

  document.getElementById("sectors-detail").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>Leading Sector ${statusPill(evalResult.status)}</h2>
        <div class="sub">Sector ETF performance vs SPY over the last 3 months. Click a ticker to expand its top 5 movers.</div>
      </div>
      <div class="updated">${d.asOf ? `Prices as of ${d.asOf}` : `Leader: ${d.topTicker}`}</div>
    </div>
    ${d.defensiveLeader ? `<div class="rule-box notice">${d.defensiveLeader.ticker} (${d.defensiveLeader.name}) tops the table at ${d.defensiveLeader.relStrength3M >= 0 ? "+" : ""}${d.defensiveLeader.relStrength3M.toFixed(1)}pp vs SPY, but it's a non-growth sector. Its outperformance reflects a risk-off rotation, so the condition is scored on the best growth sector instead.</div>` : ""}
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Growth leader</div><div class="stat-value">${d.topTicker}</div><div class="stat-sub">${d.topName}</div></div>
      <div class="stat"><div class="stat-label">3M Return</div><div class="stat-value">${d.absReturn3M >= 0 ? "+" : ""}${d.absReturn3M.toFixed(1)}%</div><div class="stat-sub">absolute</div></div>
      <div class="stat"><div class="stat-label">vs SPY</div><div class="stat-value">${d.relStrength3M >= 0 ? "+" : ""}${d.relStrength3M.toFixed(1)}pp</div><div class="stat-sub">relative strength</div></div>
      <div class="stat"><div class="stat-label">Status</div><div class="stat-value">${d.relStrength3M >= 3 ? "Clear" : "—"}</div><div class="stat-sub">${d.relStrength3M >= 3 ? "outperformer (≥3pp)" : "needs ≥3pp vs S&P"}</div></div>
    </div>
    <div class="detail-section">
      <h3>All sector ETFs ranked — click to expand</h3>
      <table class="data sectors-table">
        <colgroup>
          <col class="col-rank">
          <col class="col-ticker">
          <col class="col-name">
          <col class="col-abs">
          <col class="col-rel">
        </colgroup>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Ticker</th>
            <th>Sector</th>
            <th class="num has-tooltip" title="Absolute price return of the sector ETF over the last 3 months (Yahoo Finance raw closes).">3M Return</th>
            <th class="num has-tooltip" title="ETF 3M return minus SPY 3M return — measures relative outperformance. Sectors with the highest vs-SPY % are leading the market. Trigger needs the top growth sector ≥3pp above SPY.">vs SPY</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when a growth sector (Tech, Semis, Consumer Disc., Communications, Financials, Industrials) clearly outperforms the S&P 500 — a 3-month relative strength of ≥3pp. Defensive and commodity sectors are shown but can't lead. A clear outperformer (Mag 7 in 2025, semis in 2026) signals institutional capital is flowing into a defensible theme; the Earnings condition then confirms those outperformers are backed by EPS beats.
    </div>
  `;

  // Wire expand/collapse
  document.querySelectorAll("#sectors-detail .sector-row").forEach(row => {
    row.addEventListener("click", async () => {
      const ticker = row.dataset.ticker;
      const detailRow = document.querySelector(`#sectors-detail .sector-detail-row[data-detail="${ticker}"]`);
      const wrap = detailRow.querySelector(".constituents-wrap");
      const expander = row.querySelector(".expander");
      const isOpen = !detailRow.hidden;

      if (isOpen) {
        detailRow.hidden = true;
        expander.textContent = "▶";
        return;
      }

      detailRow.hidden = false;
      expander.textContent = "▼";
      if (!wrap.dataset.loaded) {
        wrap.innerHTML = `<div class="constituents-loading">Loading top movers…</div>`;
        let movers;
        try {
          if (window.CONFIG && window.CONFIG.USE_REAL_DATA) {
            movers = await fetchTopMovers(ticker);
            if (movers.length === 0) throw new Error("no live data");
          } else {
            const sectorEntry = d.allRanked.find(s => s.ticker === ticker);
            movers = genMockMovers(ticker, sectorEntry ? sectorEntry.relStrength3M : 0);
          }
        } catch (e) {
          const sectorEntry = d.allRanked.find(s => s.ticker === ticker);
          movers = genMockMovers(ticker, sectorEntry ? sectorEntry.relStrength3M : 0);
        }
        const top5 = movers.slice(0, 5);
        wrap.innerHTML = `
          <div class="movers-wrapper">
            <table class="data movers-detail">
              <colgroup>
                <col class="col-md-ticker">
                <col class="col-md-name">
                <col class="col-md-cap">
                <col class="col-md-ytd">
                <col class="col-md-1y">
                <col class="col-md-spark">
              </colgroup>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Name</th>
                  <th class="num">Market Cap</th>
                  <th class="num">YTD</th>
                  <th class="num">1 Year</th>
                  <th>Chart (1Y)</th>
                </tr>
              </thead>
              <tbody>
                ${top5.map(c => {
                  const ytdPos = c.ytd >= 0;
                  const oneYPos = c.oneY >= 0;
                  const sparkColor = oneYPos ? "#2ea043" : "#da3633";
                  const cap = MARKET_CAPS[c.ticker];
                  const name = COMPANY_NAMES[c.ticker] || "";
                  return `
                    <tr>
                      <td class="md-ticker"><strong>${c.ticker}</strong></td>
                      <td class="md-name">${name}</td>
                      <td class="num md-cap">${formatMarketCap(cap)}</td>
                      <td class="num ${ytdPos ? "beat" : "miss"}">${ytdPos ? "+" : ""}${c.ytd.toFixed(1)}%</td>
                      <td class="num ${oneYPos ? "beat" : "miss"}">${oneYPos ? "+" : ""}${c.oneY.toFixed(1)}%</td>
                      <td class="md-spark">${sparklineSVG(c.prices, sparkColor, 150, 28, 22, 4)}</td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
            <div class="constituents-note">Top 5 by YTD among the ETF's ${SECTOR_CONSTITUENTS[ticker]?.length || 0} largest holdings · YTD &amp; 1-year price change · chart is 1-year</div>
          </div>
        `;
        wrap.dataset.loaded = "1";
      }
    });
  });
}

// Small green/red squares for a ticker's last N quarters (oldest → newest).
function beatStrip(history, n = 6) {
  const cells = [...(history || [])].slice(0, n).reverse().map(q => {
    const cls = q.beat ? "b" : "m";
    const s = Number(q.surprise ?? 0);
    return `<span class="beat-cell ${cls}" title="${q.quarter}: ${q.beat ? "BEAT" : "MISS"} (${s >= 0 ? "+" : ""}${s.toFixed(1)}%)"></span>`;
  }).join("");
  return `<span class="beat-strip">${cells}</span>`;
}

function renderEarningsDetail(d, evalResult) {
  const reported = d.perTicker.filter(t => t.beat !== null && t.beat !== undefined);
  const avgSurprise = reported.length
    ? reported.reduce((a, t) => a + (t.surprise || 0), 0) / reported.length : 0;
  const beatCount = reported.filter(t => t.beat).length;
  const universe = d.universe ?? d.perTicker.length;
  const missing = universe - reported.length;
  const trend = d.quarterlyTrend || [];
  const momentumUp = trend.length >= 2 && trend[trend.length - 1].beatRate >= trend[0].beatRate;

  const rows = d.perTicker.map(t => {
    const hasHist = (t.history || []).length > 0;
    const noData = t.beat === null || t.beat === undefined;
    const cls = noData ? "na" : t.beat ? "beat" : "miss";
    return `
      <tr class="earn-row${hasHist ? "" : " no-hist"}" data-ticker="${t.ticker}">
        <td>${hasHist ? '<span class="expander">▶</span> ' : ""}<strong>${t.ticker}</strong></td>
        <td class="num">${noData ? "–" : `${t.estimate?.toFixed(2) ?? "–"} → ${t.actual?.toFixed(2) ?? "–"}`}</td>
        <td class="num ${cls}">${noData || t.surprise == null ? "–" : `${t.surprise >= 0 ? "+" : ""}${t.surprise.toFixed(1)}%`}</td>
        <td class="${cls}">${noData ? "No data" : t.beat ? "BEAT" : "MISS"}</td>
        <td class="beat-strip-cell">${beatStrip(t.history)}</td>
      </tr>
      <tr class="earn-detail-row" data-detail="${t.ticker}" hidden>
        <td colspan="5"><div class="earn-hist-wrap" data-content="${t.ticker}"></div></td>
      </tr>`;
  }).join("");

  document.getElementById("earnings-detail").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>Earnings Profile ${statusPill(evalResult.status)}</h2>
        <div class="sub">EPS beats for the leading sector's (${d.sectorTicker}) top constituents. Click a ticker for its quarterly history.</div>
      </div>
      <div class="updated">Leading sector: ${d.sectorTicker}${d.asOf ? ` · latest quarter ended ${d.asOf}` : ""}${d.provider ? ` · ${d.provider}` : ""}</div>
    </div>
    ${missing > 0 ? `<div class="rule-box notice">${missing} of ${universe} constituents have no earnings data from the source right now. They're excluded from the beat rate, and the condition only passes if the confirmed beats alone reach 60% of all ${universe}.</div>` : ""}
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Beat rate</div><div class="stat-value">${(d.beatRate * 100).toFixed(0)}%</div><div class="stat-sub">${beatCount} of ${reported.length} reported beat</div></div>
      <div class="stat"><div class="stat-label">Avg surprise</div><div class="stat-value">${avgSurprise >= 0 ? "+" : ""}${avgSurprise.toFixed(1)}%</div><div class="stat-sub">vs consensus EPS</div></div>
      <div class="stat"><div class="stat-label">Momentum</div><div class="stat-value ${momentumUp ? "mom-up" : "mom-down"}">${momentumUp ? "▲ Up" : "▼ Soft"}</div><div class="stat-sub">beat-rate trajectory</div></div>
      <div class="stat"><div class="stat-label">Data coverage</div><div class="stat-value">${reported.length} / ${universe}</div><div class="stat-sub">top-${universe} ETF holdings</div></div>
    </div>
    <div class="detail-section">
      <h3>Latest quarter — per ticker · recent quarters at right</h3>
      <table class="data earnings-table">
        <thead><tr><th>Ticker</th><th class="num">Est → Act</th><th class="num">Surprise</th><th>Latest</th><th>Beat history</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when ≥60% of the leading sector's top constituents beat their EPS estimate. A sector that's both clearly outperforming <em>and</em> beating earnings has fundamental backing — the kind institutions chase. The momentum strip shows whether that beat rate is on an upward trajectory.
    </div>`;

  // Wire expand/collapse for per-ticker quarterly history.
  document.querySelectorAll("#earnings-detail .earn-row").forEach(row => {
    if (row.classList.contains("no-hist")) return;
    row.addEventListener("click", () => {
      const ticker = row.dataset.ticker;
      const detailRow = document.querySelector(`#earnings-detail .earn-detail-row[data-detail="${ticker}"]`);
      const wrap = detailRow.querySelector(".earn-hist-wrap");
      const expander = row.querySelector(".expander");
      if (!detailRow.hidden) { detailRow.hidden = true; if (expander) expander.textContent = "▶"; return; }
      detailRow.hidden = false;
      if (expander) expander.textContent = "▼";
      if (!wrap.dataset.loaded) {
        const t = d.perTicker.find(x => x.ticker === ticker);
        const hist = [...(t?.history || [])]; // newest first
        wrap.innerHTML = `
          <table class="data earn-hist">
            <thead><tr><th>Quarter</th><th class="num">Estimate</th><th class="num">Actual</th><th class="num">Surprise</th><th>Result</th></tr></thead>
            <tbody>${hist.map(q => `
              <tr>
                <td>${q.quarter}</td>
                <td class="num">${q.estimate?.toFixed(2) ?? "–"}</td>
                <td class="num">${q.actual?.toFixed(2) ?? "–"}</td>
                <td class="num ${q.beat ? "beat" : "miss"}">${q.surprise >= 0 ? "+" : ""}${(q.surprise ?? 0).toFixed(1)}%</td>
                <td class="${q.beat ? "beat" : "miss"}">${q.beat ? "BEAT" : "MISS"}</td>
              </tr>`).join("")}
            </tbody>
          </table>`;
        wrap.dataset.loaded = "1";
      }
    });
  });
}

// ============================================================
// Chart helpers
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

function toMonthYear(label) {
  const p = parseDateLabel(label);
  return p ? `${p.m}/${p.y}` : String(label);
}
function toMonthYearLong(label) {
  const p = parseDateLabel(label);
  if (!p) return String(label);
  const months = ["", "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(p.m)]} ${p.y}`;
}
function toFullDate(label) {
  const p = parseDateLabel(label);
  if (!p) return String(label);
  const months = ["", "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(p.m)]} ${parseInt(p.d)}, ${p.y}`;
}

function drawLineChart(canvasId, labels, values, opts = {}) {
  const valueLabel    = opts.valueLabel ?? "Value";
  const valueDecimals = opts.valueDecimals ?? 2;
  const valueSuffix   = opts.valueSuffix ?? "";

  const datasets = [{
    label: valueLabel,
    data: values,
    borderColor: opts.color || "#58a6ff",
    backgroundColor: "rgba(88,166,255,0.08)",
    fill: true,
    tension: 0.2,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: opts.color || "#58a6ff",
    pointHoverBorderColor: "#fff",
    pointHoverBorderWidth: 2,
    borderWidth: 2
  }];
  if (opts.thresholds) {
    opts.thresholds.forEach(t => {
      datasets.push({
        label: t.label,
        data: values.map(() => t.value),
        borderColor: t.color,
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        _isThreshold: true
      });
    });
  }
  new Chart(document.getElementById(canvasId), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(13,17,23,0.95)",
          borderColor: "#30363d",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e6edf3",
          bodyColor: "#e6edf3",
          titleFont: { size: 12, weight: "600" },
          bodyFont: { family: "ui-monospace, SFMono-Regular, Menlo, monospace", size: 12 },
          filter: (item) => !item.dataset._isThreshold,
          callbacks: {
            title: (items) => opts.format ? toMonthYearLong(items[0].label) : toFullDate(items[0].label),
            label: (item) => `${item.dataset.label}: ${
              opts.format ? opts.format(item.parsed.y) : item.parsed.y.toFixed(valueDecimals) + valueSuffix}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            color: "#8b949e",
            callback: (v) => opts.format ? opts.format(v) : `${v}${valueSuffix}`
          },
          grid: { color: "rgba(139,148,158,0.12)" }
        },
        x: {
          ticks: {
            color: "#8b949e",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            callback: function (value) {
              return toMonthYear(this.getLabelForValue(value));
            }
          },
          grid: { display: false }
        }
      }
    }
  });
}

function drawBarChart(canvasId, labels, values, opts = {}) {
  // Bars always start at zero (bar length must encode the value).
  // opts: valueLabel, format(v) -> string, colorFor(v), hoverColorFor(v),
  //       afterLabel(index) -> extra tooltip line.
  const valueLabel = opts.valueLabel ?? "Value";
  const format     = opts.format || (v => v.toFixed(1));
  const colorFor   = opts.colorFor || (() => "#58a6ff");
  const hoverFor   = opts.hoverColorFor || colorFor;

  new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: valueLabel,
        data: values,
        backgroundColor: values.map(colorFor),
        hoverBackgroundColor: values.map(hoverFor),
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(13,17,23,0.95)",
          borderColor: "#30363d",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e6edf3",
          bodyColor: "#e6edf3",
          titleFont: { size: 12, weight: "600" },
          bodyFont: { family: "ui-monospace, SFMono-Regular, Menlo, monospace", size: 12 },
          callbacks: {
            title: (items) => toMonthYearLong(items[0].label),
            label: (item) => `${item.dataset.label}: ${format(item.parsed.y)}`,
            afterLabel: (item) => (opts.afterLabel ? opts.afterLabel(item.dataIndex) : undefined)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#8b949e", callback: (v) => (opts.tickFormat || format)(v) },
          grid: {
            // Emphasise the zero line so increases vs decreases read at a glance.
            color: (ctx) => (ctx.tick && ctx.tick.value === 0 ? "rgba(139,148,158,0.55)" : "rgba(139,148,158,0.12)")
          }
        },
        x: {
          ticks: {
            color: "#8b949e",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            callback: function (value) {
              return toMonthYear(this.getLabelForValue(value));
            }
          },
          grid: { display: false }
        }
      }
    }
  });
}

// ============================================================
// Tab switching
// ============================================================
function activateTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
  // On phones the tab bar scrolls sideways; keep the active tab in view.
  const activeTab = document.querySelector(`.tab[data-tab="${name}"]`);
  const bar = document.getElementById("tabs");
  if (activeTab && bar && bar.scrollWidth > bar.clientWidth) {
    const offset = activeTab.getBoundingClientRect().left - bar.getBoundingClientRect().left;
    bar.scrollBy({ left: offset - (bar.clientWidth - activeTab.offsetWidth) / 2, behavior: "smooth" });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (e) => {
  if (e.target.matches(".tab")) activateTab(e.target.dataset.tab);
});

// ============================================================
// Live fetchers
// ============================================================
// VIX is fetched from two sources in parallel and the one with the most
// recent quote wins. Yahoo (^VIX via /api/quotes) is primary; the
// datasets/finance-vix CSV is a fallback for local dev or a Yahoo outage.
// (finance-vix silently stopped updating after 2026-09-22, which froze the
// dashboard — picking the freshest source guards against that recurring.)
const VIX_STALE_DAYS = 5; // > a long weekend + holiday without a new close

async function fetchVIX_yahoo() {
  const host = (typeof location !== "undefined" ? location.hostname : "") || "";
  if (host === "localhost" || host === "127.0.0.1" || host === "") {
    throw new Error("proxy unavailable in local dev");
  }
  const resp = await fetch("/api/quotes?ticker=%5EVIX&range=1y", { cache: "no-cache" });
  if (!resp.ok) throw new Error(`Yahoo ^VIX HTTP ${resp.status}`);
  const json = await resp.json();
  const rows = (json.rows || [])
    .map(r => ({ date: r.date, value: parseFloat(r.close.toFixed(2)) }))
    .filter(r => r.date && !isNaN(r.value));
  if (rows.length === 0) throw new Error("Yahoo ^VIX no valid rows");
  const last = rows[rows.length - 1];
  return { value: last.value, asOf: last.date, history: rows.slice(-252), feed: "Yahoo" };
}

async function fetchVIX_live() {
  const results = await Promise.allSettled([fetchVIX_yahoo(), fetchVIX_csv()]);
  const ok = results.filter(r => r.status === "fulfilled").map(r => r.value);
  if (ok.length === 0) {
    throw new Error(results.map(r => r.reason?.message || r.reason).join("; "));
  }
  // ISO dates compare correctly as strings. Ties go to Yahoo (listed first).
  const best = ok.reduce((a, b) => (b.asOf > a.asOf ? b : a));
  const ageDays = (Date.now() - new Date(best.asOf + "T00:00:00Z").getTime()) / 86400000;
  const stale = ageDays > VIX_STALE_DAYS;
  if (stale) console.warn(`[VIX] freshest quote is ${best.asOf} (${ageDays.toFixed(0)} days old)`);
  return { ...best, stale, source: "live" };
}

async function fetchVIX_csv() {
  // Source: github.com/datasets/finance-vix — CSV via raw.githubusercontent.com (CORS-friendly).
  // CSV columns: Date,VIX Open,VIX High,VIX Low,VIX Close
  const url = "https://raw.githubusercontent.com/datasets/finance-vix/main/data/vix-daily.csv";
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`finance-vix HTTP ${resp.status}`);
  const text = await resp.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("finance-vix empty");

  // Skip header. Parse Date + Close.
  const rows = lines.slice(1).map(line => {
    const c = line.split(",");
    return { date: c[0], value: parseFloat(c[4]) };
  }).filter(r => r.date && !isNaN(r.value));
  if (rows.length === 0) throw new Error("finance-vix no valid rows");

  const last = rows[rows.length - 1];
  const history = rows.slice(-252); // ~1 year of trading days
  return { value: last.value, asOf: last.date, history, feed: "finance-vix" };
}

async function fetchFRED_csv(seriesId) {
  // Public FRED CSV — no API key required.
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`FRED ${seriesId} HTTP ${resp.status}`);
  const text = await resp.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error(`FRED ${seriesId} empty`);
  return lines.slice(1).map(line => {
    const [date, val] = line.split(",");
    return { date: (date || "").trim(), value: parseFloat(val) };
  }).filter(r => r.date && !isNaN(r.value));
}

async function fetchFedSeries() {
  // 1) Try the serverless proxy first (CORS-free, server-side FRED CSV).
  const host = (typeof location !== "undefined" ? location.hostname : "") || "";
  const proxyAvailable = host && host !== "localhost" && host !== "127.0.0.1";
  if (proxyAvailable) {
    try {
      const resp = await fetch("/api/fed-rate");
      if (resp.ok) {
        const json = await resp.json();
        if (json.upper?.length && json.lower?.length) {
          return {
            upper: json.upper,
            lower: json.lower,
            projections: json.projections && Object.keys(json.projections).length ? json.projections : null,
            sourceLabel: "FRED (proxy)"
          };
        }
      }
    } catch (e) {
      console.warn("FRED proxy failed, trying direct CSV:", e.message || e);
    }
  }
  // 2) Try public fredgraph.csv from the browser (may or may not pass CORS).
  try {
    const [upper, lower] = await Promise.all([
      fetchFRED_csv("DFEDTARU"),
      fetchFRED_csv("DFEDTARL")
    ]);
    if (upper.length === 0 || lower.length === 0) throw new Error("empty");
    return { upper, lower, sourceLabel: "FRED (direct)" };
  } catch (e) {
    console.warn("fredgraph.csv unavailable, trying data/fed.json:", e.message || e);
  }
  // 3) Manual fallback file (FOMC-meeting granularity).
  const resp = await fetch("data/fed.json");
  if (!resp.ok) throw new Error("data/fed.json missing");
  const local = await resp.json();
  if (!local.history || local.history.length === 0) throw new Error("data/fed.json empty");
  const upper = local.history.map(p => ({ date: p.date, value: p.upper }));
  const lower = local.history.map(p => ({ date: p.date, value: p.lower }));
  return { upper, lower, sourceLabel: "manual" };
}

async function fetchFed_live() {
  const fed = await fetchFedSeries();
  const { upper, lower } = fed;
  const last     = upper[upper.length - 1];
  const lastLow  = lower[lower.length - 1] || last;
  const sixMo    = upper.slice(-180);
  const sixMoMA  = sixMo.reduce((a, p) => a + p.value, 0) / sixMo.length;

  // Prefer live dot-plot medians from the FRED proxy (FEDTARMD/FEDTARMDLR).
  // Fall back to the manually maintained data/dotplot.json if absent.
  let projections, direction, projSource;
  if (fed.projections) {
    projections = fed.projections;
    projSource = "latest FOMC SEP via FRED";
    const midpoint = (last.value + lastLow.value) / 2;
    const vals = Object.values(projections).filter(v => typeof v === "number");
    const anyHigher = vals.some(v => v > midpoint + 0.10);
    const anyLower  = vals.some(v => v < midpoint - 0.10);
    direction = anyHigher ? "up" : anyLower ? "down" : "flat";
  } else {
    const dot = await fetch("data/dotplot.json").then(r => r.json());
    projections = dot.projections || {};
    direction = dot.direction;
    projSource = `${formatAsOf(dot.meeting) || "manual"} SEP (data/dotplot.json)`;
  }
  const ye = projections[String(new Date().getFullYear())] ?? last.value;

  return {
    current: last.value,
    currentUpper: last.value,
    currentLow:  lastLow.value,
    sixMoMA,
    projections,
    dotMedianYearEnd: ye,
    direction,
    projSource,
    rateSource: fed.sourceLabel,
    asOf: last.date,
    // Pass enough historical data (~7 years daily) so the trajectory chart
    // can render a balanced past-vs-future window. drawFedTrajectoryChart
    // trims this to whatever span matches the furthest projection.
    history: upper.slice(-1800),
    source: "live"
  };
}

async function fetchMargin_live() {
  // 1) Try the serverless proxy (live FINRA scrape).
  const host = (typeof location !== "undefined" ? location.hostname : "") || "";
  const proxyAvailable = host && host !== "localhost" && host !== "127.0.0.1";
  if (proxyAvailable) {
    try {
      const resp = await fetch("/api/finra-margin");
      if (resp.ok) {
        const json = await resp.json();
        const h = json.history || [];
        if (h.length >= 2) {
          const latest = h[h.length - 1];
          const prior  = h[h.length - 2];
          return {
            asOf: latest.month,
            unitsLabel: json.unitsLabel || "$B",
            history: h,
            latest: latest.value,
            prior: prior.value,
            source: "live"
          };
        }
      }
    } catch (e) {
      console.warn("FINRA proxy failed, falling back to local JSON:", e.message || e);
    }
  }
  // 2) Manual JSON fallback (kept in repo as last resort).
  const resp = await fetch("data/finra_margin.json");
  if (!resp.ok) throw new Error(`finra_margin.json HTTP ${resp.status}`);
  const json = await resp.json();
  const h = json.history || [];
  if (h.length < 2) throw new Error("finra_margin.json needs ≥2 history points");
  const latest = h[h.length - 1];
  const prior  = h[h.length - 2];
  return {
    asOf: latest.month,
    unitsLabel: json.unitsLabel || "$B",
    history: h,
    latest: latest.value,
    prior: prior.value,
    source: "live"
  };
}

async function fetchStooqClose(ticker) {
  // Legacy fallback used only if fetchHistoryWithFallback fails entirely.
  const symbol = ticker.startsWith("^") ? ticker : `${ticker}.us`;
  const resp = await fetch(`https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}&i=d`);
  if (!resp.ok) throw new Error(`Stooq ${ticker} HTTP ${resp.status}`);
  const text = await resp.text();
  const lines = text.trim().split("\n").slice(1);
  if (lines.length < 66) throw new Error(`Stooq ${ticker} short history`);
  const recent = lines.slice(-66);
  const first = parseFloat(recent[0].split(",")[4]);
  const last  = parseFloat(recent[recent.length - 1].split(",")[4]);
  if (isNaN(first) || isNaN(last)) throw new Error(`Stooq ${ticker} parse failed`);
  return ((last - first) / first) * 100;
}

// Derive 3-month % return from a 1-year price series (last ~66 trading days).
function _compute3M(prices) {
  if (!prices || prices.length < 66) return null;
  const start = prices[prices.length - 66];
  const end   = prices[prices.length - 1];
  if (!start || isNaN(start) || isNaN(end)) return null;
  return ((end - start) / start) * 100;
}

async function fetchLeading_live() {
  // Use the unified history fetcher (proxy → Yahoo direct → Stooq), then slice 3M.
  // This keeps the data source consistent with the constituent expansion view.
  const tickers = ["SPY", ...Object.keys(SECTOR_ETFS)];
  const settled = await Promise.allSettled(tickers.map(t => fetchHistoryWithFallback(t)));
  const closes = {};
  let lastDate = null;
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const m3 = _compute3M(r.value.prices);
    if (m3 != null) closes[tickers[i]] = m3;
    if (tickers[i] === "SPY") lastDate = r.value.lastDate || null;
  });
  if (closes["SPY"] == null) throw new Error("SPY 3M close missing");
  const spy = closes["SPY"];
  const allRanked = Object.keys(SECTOR_ETFS)
    .filter(t => closes[t] != null)
    .map(t => ({
      ticker: t,
      name: SECTOR_ETFS[t],
      absReturn3M: closes[t],
      relStrength3M: closes[t] - spy,
      growth: GROWTH_SECTORS.has(t)
    }))
    .sort((a, b) => b.relStrength3M - a.relStrength3M);
  return { ...summarizeSectors(allRanked, spy), asOf: lastDate, source: "live" };
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

async function fetchEarnings_live(sectorTicker) {
  // Routes through the /api/earnings serverless function which scrapes
  // MarketBeat via r.jina.ai (no key, edge-cached 7 days per ticker).
  // Falls through to mock when the proxy isn't available (local dev).
  const host = (typeof location !== "undefined" ? location.hostname : "") || "";
  if (host === "localhost" || host === "127.0.0.1" || host === "") {
    throw new Error("earnings proxy unavailable in local dev");
  }
  const tickers = SECTOR_CONSTITUENTS[sectorTicker] || [];
  if (tickers.length === 0) throw new Error(`No constituents for ${sectorTicker}`);

  const results = await Promise.allSettled(tickers.map(t =>
    fetch(`/api/earnings?ticker=${encodeURIComponent(t)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
  ));

  const perTicker = [];
  let beats = 0, total = 0, upwardSum = 0, asOf = null, provider = null;
  results.forEach((r, i) => {
    const ticker = tickers[i];
    if (r.status !== "fulfilled" || !r.value || !r.value.latest) {
      // Missing data is NOT a miss — beat stays null and it's excluded from
      // the beat rate; evalEarnings accounts for the gap explicitly.
      perTicker.push({ ticker, actual: null, estimate: null, surprise: null, beat: null, history: [] });
      return;
    }
    if (r.value.latest.date && (!asOf || r.value.latest.date > asOf)) asOf = r.value.latest.date;
    provider = provider || r.value.provider || null;
    const latest = r.value.latest;
    const beat   = Boolean(latest.beat);
    total++;
    if (beat) beats++;
    perTicker.push({
      ticker,
      actual:   latest.actual,
      estimate: latest.estimate,
      surprise: latest.surprise,
      beat,
      history: Array.isArray(r.value.history) ? r.value.history : []
    });
    const last4 = (r.value.history || []).slice(0, 4);
    upwardSum += last4.filter(q => q.beat).length;
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
    quarterlyTrend: buildEarningsTrend(perTicker),
    source: "live"
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

// ============================================================
// Orchestration
// ============================================================
// A source that hangs (no response, no error) would otherwise block the
// whole dashboard on "Loading…" forever — cap each one and fall back.
const SOURCE_TIMEOUT_MS = 20000;

async function withFallback(name, fn, fallback) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${SOURCE_TIMEOUT_MS / 1000}s`)), SOURCE_TIMEOUT_MS);
  });
  try { return await Promise.race([fn(), timeout]); }
  catch (err) {
    console.warn(`[${name}] live fetch failed, using mock:`, err.message || err);
    return { ...fallback, source: "mock" };
  }
  finally { clearTimeout(timer); }
}

async function loadData() {
  const useReal = window.CONFIG && window.CONFIG.USE_REAL_DATA;
  // Margin always loads from local JSON (never CORS-blocked).
  const marginP = withFallback("Margin", fetchMargin_live, MOCK.margin);
  if (!useReal) {
    const margin = await marginP;
    return { ...MOCK, margin, dataMode: "mock data" };
  }
  const [vix, fed, leadingSector, margin] = await Promise.all([
    withFallback("VIX",     fetchVIX_live,     MOCK.vix),
    withFallback("Fed",     fetchFed_live,     MOCK.fed),
    withFallback("Leading", fetchLeading_live, MOCK.leadingSector),
    marginP
  ]);
  const earnings = await withFallback(
    "Earnings",
    () => fetchEarnings_live(leadingSector.topTicker),
    { ...MOCK.earnings, sectorTicker: leadingSector.topTicker }
  );
  const liveCount = [vix, fed, margin, leadingSector, earnings].filter(d => d.source === "live").length;
  return { vix, fed, margin, leadingSector, earnings, dataMode: `${liveCount}/5 live` };
}

async function main() {
  const data = await loadData();
  const results = [
    evalVIX(data.vix),
    evalFed(data.fed),
    evalMargin(data.margin),
    evalLeading(data.leadingSector),
    evalEarnings(data.earnings)
  ];
  const score = results.filter(r => r.pass).length;
  renderCards(results);
  renderScore(score, results);
  renderVIXDetail(data.vix, results[0]);
  renderFedDetail(data.fed, results[1]);
  renderMarginDetail(data.margin, results[2]);
  renderSectorsDetail(data.leadingSector, results[3]);
  renderEarningsDetail(data.earnings, results[4]);

  // This is when the page fetched data, not when the data is from — each
  // card carries its own "as of" date for that.
  const checked = new Date().toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
  });
  const lu = document.getElementById("last-updated");
  lu.textContent = `Checked ${checked}`;
  lu.title = "When this page last fetched data. Each card shows its own data date.";
  document.getElementById("data-mode").textContent = data.dataMode;

  try {
    const history = await fetch("data/history.json").then(r => r.json());
    await renderHistory(history.points, new Date().toISOString(), score);
  } catch (err) {
    console.warn("history.json load failed:", err);
  }
}

// On phones, default-collapse the explanatory sections so the dashboard
// surfaces score/cards/chart first. Users can tap to expand each block.
function collapseExplanatoryOnMobile() {
  if (!window.matchMedia("(max-width: 768px)").matches) return;
  document.querySelectorAll("details.collapsible").forEach(d => d.removeAttribute("open"));
}
collapseExplanatoryOnMobile();

// Theme toggle — initial theme is applied by the inline script in <head>
// (prevents FOUC). This wires the click handler that flips it.
function initThemeToggle() {
  const THEME_KEY = "met-theme";
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = cur === "light" ? "dark" : "light";
    if (next === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  });
}
initThemeToggle();

main();
