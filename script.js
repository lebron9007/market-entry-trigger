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
    topTicker: "SMH", topName: "Semiconductors",
    absReturn3M: 17.4,
    relStrength3M: 12.4,
    spy3M: 5.0,
    runnerUp: { ticker: "XLK", name: "Technology", absReturn3M: 12.1, relStrength3M: 7.1 },
    decisive: true,
    allRanked: [
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
    ],
    source: "mock"
  },
  earnings: {
    sectorTicker: "SMH",
    beatRate: 0.68,
    quartersUpward: 3,
    sample: 10,
    perTicker: [
      { ticker: "NVDA", actual: 5.16, estimate: 4.80, surprise: 7.5, beat: true },
      { ticker: "TSM",  actual: 1.94, estimate: 1.85, surprise: 4.9, beat: true },
      { ticker: "AVGO", actual: 1.42, estimate: 1.38, surprise: 2.9, beat: true },
      { ticker: "AMD",  actual: 0.92, estimate: 0.88, surprise: 4.5, beat: true },
      { ticker: "ASML", actual: 6.20, estimate: 5.95, surprise: 4.2, beat: true },
      { ticker: "QCOM", actual: 2.80, estimate: 2.85, surprise: -1.8, beat: false },
      { ticker: "INTC", actual: 0.18, estimate: 0.22, surprise: -18.2, beat: false },
      { ticker: "AMAT", actual: 2.10, estimate: 2.05, surprise: 2.4, beat: true },
      { ticker: "LRCX", actual: 1.05, estimate: 0.98, surprise: 7.1, beat: true },
      { ticker: "KLAC", actual: 8.20, estimate: 8.05, surprise: 1.9, beat: true }
    ],
    source: "mock"
  }
};

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
    source: d.source
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
    source: d.source
  };
}

function evalMargin(d) {
  const delta = d.latest - d.prior;
  const pctDelta = (delta / d.prior) * 100;
  const status = pctDelta < -1 ? "green" : pctDelta < 0 ? "yellow" : "red";
  return {
    title: "Margin Debt", tab: "margin",
    pass: status === "green", status,
    value: `${d.unitsLabel}${d.latest.toFixed(0)}`,
    takeaway: `${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(1)}% MoM. ${
      status === "green" ? "Decreasing — meets trigger." :
      status === "yellow" ? "Slight decrease; below margin." :
      "Increasing — fails trigger."}`,
    rule: "Trigger when FINRA margin debt is decreasing",
    source: d.source
  };
}

function evalLeading(d) {
  const status = d.decisive ? "green" : d.relStrength3M > 3 ? "yellow" : "red";
  return {
    title: "Leading Sector", tab: "sectors",
    pass: status === "green", status,
    value: d.topTicker,
    takeaway: `${d.topName} ${d.relStrength3M >= 0 ? "+" : ""}${d.relStrength3M.toFixed(1)}% vs SPY (3M).`,
    rule: "Trigger when one sector decisively outperforms (lead ≥3pp over runner-up)",
    source: d.source
  };
}

function evalEarnings(d) {
  const status = d.beatRate >= 0.60 ? "green" : d.beatRate >= 0.50 ? "yellow" : "red";
  return {
    title: "Earnings Profile", tab: "earnings",
    pass: status === "green", status,
    value: `${(d.beatRate * 100).toFixed(0)}%`,
    takeaway: `${d.sectorTicker} top-${d.sample} beating EPS. ${d.quartersUpward}/4 quarters trending up.`,
    rule: "Trigger when leading sector beats EPS ≥60% during macro pain",
    source: d.source
  };
}

// ============================================================
// Score & verdict
// ============================================================
function computeConfidence(score) {
  return [5, 15, 30, 50, 70, 85][Math.max(0, Math.min(5, score))];
}
function verdictFor(score) {
  if (score === 5) return "All five conditions met. Historical base rate for positive 12-month forward returns: ~80–85%.";
  if (score === 4) return "Four conditions met. Strong setup, one short of full alignment.";
  if (score === 3) return "Three conditions met. Mixed signals — half the framework is favorable.";
  if (score === 2) return "Two conditions met. Most signals remain unfavorable.";
  if (score === 1) return "One condition met. Framework indicates a risk-on regime.";
  return "No conditions met. Framework signals caution.";
}

// ============================================================
// Lean overview cards
// ============================================================
function renderCards(results) {
  const root = document.getElementById("cards");
  root.innerHTML = "";
  results.forEach(r => {
    const el = document.createElement("div");
    el.className = `card ${r.status}`;
    el.dataset.tab = r.tab;
    const sourceTag = r.source === "live"
      ? `<span class="source-tag live">live</span>`
      : `<span class="source-tag mock">mock</span>`;
    el.innerHTML = `
      <div class="card-head">
        <span class="card-title">${r.title}</span>
        <span class="status-pill ${r.status}">${r.status === "green" ? "PASS" : r.status === "yellow" ? "WATCH" : "FAIL"}</span>
      </div>
      <div class="card-value">${r.value} ${sourceTag}</div>
      <div class="card-takeaway">${r.takeaway}</div>
      <div class="card-link">View details →</div>
    `;
    el.addEventListener("click", () => activateTab(r.tab));
    root.appendChild(el);
  });
}

function renderScore(score) {
  document.getElementById("score-number").textContent = score;
  const conf = computeConfidence(score);
  document.getElementById("confidence-value").textContent = `${conf}%`;
  document.getElementById("confidence-fill").style.width = `${conf}%`;
  const verdictEl = document.getElementById("verdict");
  verdictEl.textContent = verdictFor(score);
  const tier = score >= 5 ? "5" : score >= 4 ? "4" : score >= 3 ? "3" : "low";
  verdictEl.className = `verdict score-${tier}`;
}

// ============================================================
// History chart (overview)
// ============================================================
// Subdued sequential blue palette — peak alignment is bright accent blue,
// weak readings fade to grey. Less alarming than red/green.
function colorForScore(s) {
  if (s >= 5) return "#58a6ff";
  if (s >= 4) return "rgba(88, 166, 255, 0.65)";
  if (s >= 3) return "rgba(88, 166, 255, 0.35)";
  return "rgba(139, 148, 158, 0.35)";
}

function scoreRadius(s) {
  if (s >= 5) return 8;
  if (s >= 4) return 5;
  if (s >= 3) return 3;
  return 2;
}

// Long-range weekly SPY closes, used as the historical-alignment chart backdrop.
async function fetchSpyHistory() {
  // /api/quotes works on Vercel; in local dev fall through silently.
  const host = (typeof location !== "undefined" ? location.hostname : "") || "";
  if (host === "localhost" || host === "127.0.0.1" || host === "") return null;
  try {
    const r = await fetch("/api/quotes?ticker=SPY&range=max&interval=1wk");
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.rows || j.rows.length < 100) return null;
    return j.rows;
  } catch (_) {
    return null;
  }
}

function nearestSpyAtDate(spyRows, targetIso) {
  // Binary-search nearest weekly close to a given month string. We trim the
  // alignment label to YYYY-MM-01 and find the closest SPY row by timestamp.
  const target = new Date(`${targetIso}-01`).getTime();
  let lo = 0, hi = spyRows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (new Date(spyRows[mid].date).getTime() < target) lo = mid + 1;
    else hi = mid;
  }
  const a = spyRows[Math.max(0, lo - 1)];
  const b = spyRows[lo];
  if (!a) return b;
  if (!b) return a;
  return Math.abs(new Date(a.date) - target) < Math.abs(new Date(b.date) - target) ? a : b;
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
    `${peakNote} · Pre-2026 scores are representative estimates based on contemporaneous reports of VIX, Fed policy, margin debt, leading sectors, and earnings — not back-computed from live APIs.`;

  const canvas = document.getElementById("history-chart");

  // Pull SPY backdrop. If unavailable (local dev, proxy down), fall back to
  // the simpler score-bars chart so the panel never goes empty.
  const spyRows = await fetchSpyHistory();
  if (!spyRows) {
    new Chart(canvas, {
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

  // Filter SPY rows to start at the first alignment date so the x-axis spans
  // the same window we have alignment data for.
  const firstAlignDate = new Date(`${data[0].date}-01`).getTime();
  const spyClipped = spyRows.filter(r => new Date(r.date).getTime() >= firstAlignDate - 1000 * 60 * 60 * 24 * 90);

  const spyData = spyClipped.map(r => ({ x: r.date, y: r.close }));

  // Build scatter points: each alignment date placed on the SPY line at the
  // closest weekly close.
  const markers = data.map(p => {
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

  new Chart(canvas, {
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
          type: "logarithmic",
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
      <div class="updated">Last quote: ${d.asOf}</div>
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
      return `<tr><td>${label}</td><td class="num">${v.toFixed(3)}%</td><td class="num ${cls}">${deltaStr}</td></tr>`;
    }).join("");

  document.getElementById("fed-detail").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>Fed Trend ${statusPill(evalResult.status)}</h2>
        <div class="sub">Federal Funds target range and FOMC dot-plot projections.</div>
      </div>
      <div class="updated">FRED DFEDTARU · projections from data/dotplot.json</div>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Current target</div><div class="stat-value">${rangeStr}</div><div class="stat-sub">FOMC range (lower–upper)</div></div>
      <div class="stat"><div class="stat-label">Midpoint</div><div class="stat-value">${midpoint.toFixed(3)}%</div></div>
      <div class="stat"><div class="stat-label">Lowest projection</div><div class="stat-value">${Math.min(...Object.values(projections)).toFixed(2)}%</div><div class="stat-sub">implied trough</div></div>
      <div class="stat"><div class="stat-label">Direction</div><div class="stat-value">${(d.direction || "").toUpperCase()}</div></div>
    </div>
    <div class="detail-section">
      <h3>Rate trajectory — actual + dot-plot projection</h3>
      <div class="detail-chart"><canvas id="fed-chart"></canvas></div>
    </div>
    <div class="detail-section">
      <h3>Dot-plot medians (March 2026 SEP)</h3>
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
            label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(3)}%`
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
      <div class="stat"><div class="stat-label">Latest</div><div class="stat-value">${d.unitsLabel}${latest.value.toFixed(0)}</div></div>
      <div class="stat"><div class="stat-label">MoM</div><div class="stat-value">${momPct >= 0 ? "+" : ""}${momPct}%</div></div>
      <div class="stat"><div class="stat-label">YoY</div><div class="stat-value">${yoyPct === "–" ? "–" : (yoyPct >= 0 ? "+" : "") + yoyPct + "%"}</div></div>
      <div class="stat"><div class="stat-label">From peak</div><div class="stat-value">${fromPeakPct >= 0 ? "+" : ""}${fromPeakPct}%</div><div class="stat-sub">peak: ${d.unitsLabel}${peak.value.toFixed(0)} (${peak.month})</div></div>
    </div>
    <div class="detail-section">
      <h3>Margin debt — month-over-month direction</h3>
      <p class="chart-caption">
        <span class="swatch" style="background:#2ea043"></span> decrease (de-leveraging — bullish for entry)
        <span class="swatch" style="background:#384047; margin-left:14px"></span> flat or increase (leverage building)
      </p>
      <div class="detail-chart"><canvas id="margin-chart"></canvas></div>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when margin debt is decreasing month-over-month. Falling margin balances signal forced de-leveraging — investors are being squeezed out, and that capitulation is historically a contrarian buy signal.
    </div>
  `;
  drawBarChart("margin-chart", h.map(p => p.month), h.map(p => p.value), {
    valueLabel: "Margin Debt",
    valuePrefix: d.unitsLabel,
    valueDecimals: 1,
    highlightDrops: true,
    showMoM: true,
    tightYAxis: true
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
  return { ytd, oneY, prices: rows.map(r => r.close) };
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
  const { ytd, oneY, prices } = _computeReturns(rows);
  return { ticker, ytd, oneY, prices, source: "yahoo" };
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
  const { ytd, oneY, prices } = _computeReturns(oneYRows);
  return { ticker, ytd, oneY, prices, source: "stooq" };
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
  const { ytd, oneY, prices } = _computeReturns(json.rows);
  return { ticker, ytd, oneY, prices, source: "proxy" };
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
    const cls = i === 0 ? "highlight" : "";
    const absSign = s.absReturn3M  >= 0 ? "+" : "";
    const relSign = s.relStrength3M >= 0 ? "+" : "";
    const absClass = s.absReturn3M  >= 0 ? "beat" : "miss";
    const relClass = s.relStrength3M >= 0 ? "beat" : "miss";
    return `
      <tr class="sector-row ${cls}" data-ticker="${s.ticker}">
        <td class="num">${i + 1}</td>
        <td><span class="expander">▶</span> <strong>${s.ticker}</strong></td>
        <td>${s.name}</td>
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
      <div class="updated">Top: ${d.topTicker} (${d.topName})</div>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Leader</div><div class="stat-value">${d.topTicker}</div><div class="stat-sub">${d.topName}</div></div>
      <div class="stat"><div class="stat-label">3M Return</div><div class="stat-value">${d.absReturn3M >= 0 ? "+" : ""}${d.absReturn3M.toFixed(1)}%</div><div class="stat-sub">absolute</div></div>
      <div class="stat"><div class="stat-label">vs SPY</div><div class="stat-value">${d.relStrength3M >= 0 ? "+" : ""}${d.relStrength3M.toFixed(1)}pp</div><div class="stat-sub">relative strength</div></div>
      <div class="stat"><div class="stat-label">Lead margin</div><div class="stat-value">${(d.relStrength3M - d.runnerUp.relStrength3M).toFixed(1)}pp</div><div class="stat-sub">${d.decisive ? "decisive" : "not decisive"} · vs ${d.runnerUp.ticker}</div></div>
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
            <th class="num has-tooltip" title="ETF 3M return minus SPY 3M return — measures relative outperformance. Sectors with the highest vs-SPY % are leading the market. Trigger needs the leader ≥3pp above the runner-up.">vs SPY</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when one sector outperforms SPY by ≥3pp more than the runner-up. Clear thematic leadership (Mag 7 in 2025, semis in 2026) signals institutional capital is flowing into a defensible narrative.
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

function renderEarningsDetail(d, evalResult) {
  const rows = d.perTicker.map(t => `
    <tr>
      <td><strong>${t.ticker}</strong></td>
      <td class="num">${t.actual?.toFixed(2) ?? "–"}</td>
      <td class="num">${t.estimate?.toFixed(2) ?? "–"}</td>
      <td class="num ${t.beat ? "beat" : "miss"}">${t.surprise >= 0 ? "+" : ""}${t.surprise?.toFixed(1) ?? "–"}%</td>
      <td class="${t.beat ? "beat" : "miss"}">${t.beat ? "BEAT" : "MISS"}</td>
    </tr>
  `).join("");

  document.getElementById("earnings-detail").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>Earnings Profile ${statusPill(evalResult.status)}</h2>
        <div class="sub">Latest-quarter EPS performance for the leading sector's top constituents.</div>
      </div>
      <div class="updated">Sector: ${d.sectorTicker}</div>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Beat rate</div><div class="stat-value">${(d.beatRate * 100).toFixed(0)}%</div><div class="stat-sub">${d.perTicker.filter(t => t.beat).length} of ${d.sample} sampled</div></div>
      <div class="stat"><div class="stat-label">Avg surprise</div><div class="stat-value">${(d.perTicker.reduce((a, t) => a + (t.surprise || 0), 0) / d.perTicker.length).toFixed(1)}%</div></div>
      <div class="stat"><div class="stat-label">Quarters trending up</div><div class="stat-value">${d.quartersUpward}/4</div></div>
      <div class="stat"><div class="stat-label">Sample size</div><div class="stat-value">${d.sample}</div><div class="stat-sub">top constituents</div></div>
    </div>
    <div class="detail-section">
      <h3>Latest quarter — per ticker</h3>
      <table class="data">
        <thead><tr><th>Ticker</th><th class="num">Actual EPS</th><th class="num">Estimate</th><th class="num">Surprise</th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="rule-box">
      <strong>Rule:</strong> Trigger when ≥60% of the leading sector's top constituents beat their EPS estimate. During macro pain, sectors that <em>continue</em> beating earn fundamental support — the kind that institutions chase.
    </div>
  `;
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
            title: (items) => toFullDate(items[0].label),
            label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(valueDecimals)}${valueSuffix}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            color: "#8b949e",
            callback: (v) => `${v}${valueSuffix}`
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
  const valueLabel    = opts.valueLabel ?? "Value";
  const valueDecimals = opts.valueDecimals ?? 1;
  const valuePrefix   = opts.valuePrefix ?? "";
  const baseColor     = opts.color || "#58a6ff";
  const dropColor     = opts.dropColor || "#2ea043";   // bright green for drops
  const riseColor     = opts.riseColor || "#384047";   // muted slate for rises
  const valuesSnapshot = [...values];

  // Tight y-axis: start near min so small MoM changes are visible.
  // Round to nearest "nice" tick.
  let yMin, yMax;
  if (opts.tightYAxis && values.length > 0) {
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin;
    const pad = Math.max(range * 0.20, dataMax * 0.02);
    const stepHint = Math.pow(10, Math.floor(Math.log10(Math.max(range, 1)))) / 2;
    const niceFloor = Math.floor((dataMin - pad) / stepHint) * stepHint;
    const niceCeil  = Math.ceil ((dataMax + pad) / stepHint) * stepHint;
    yMin = Math.max(0, niceFloor);
    yMax = niceCeil;
  }

  // Color logic: if highlightDrops enabled, color each bar based on MoM direction.
  const backgroundColor = opts.highlightDrops
    ? values.map((v, i) => {
        if (i === 0) return riseColor;
        return v < values[i - 1] ? dropColor : riseColor;
      })
    : baseColor;
  const hoverBackgroundColor = opts.highlightDrops
    ? values.map((v, i) => {
        if (i === 0) return "#4a5562";
        return v < values[i - 1] ? "#3fbf57" : "#4a5562";
      })
    : "#79b8ff";

  new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: valueLabel,
        data: values,
        backgroundColor,
        hoverBackgroundColor,
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
            title: (items) => toMonthYear(items[0].label),
            label: (item) => `${item.dataset.label}: ${valuePrefix}${item.parsed.y.toFixed(valueDecimals)}`,
            afterLabel: (item) => {
              if (!opts.showMoM) return undefined;
              const i = item.dataIndex;
              if (i === 0) return undefined;
              const prev = valuesSnapshot[i - 1];
              const v = item.parsed.y;
              const pct = ((v - prev) / prev) * 100;
              const arrow = v < prev ? "▼" : v > prev ? "▲" : "·";
              return `MoM: ${arrow} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
            }
          }
        }
      },
      scales: {
        y: {
          ...(yMin !== undefined ? { min: yMin } : {}),
          ...(yMax !== undefined ? { max: yMax } : {}),
          ticks: {
            color: "#8b949e",
            callback: (v) => `${valuePrefix}${v}`
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

// ============================================================
// Tab switching
// ============================================================
function activateTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (e) => {
  if (e.target.matches(".tab")) activateTab(e.target.dataset.tab);
});

// ============================================================
// Live fetchers
// ============================================================
async function fetchVIX_live() {
  // Source: github.com/datasets/finance-vix — daily-refreshed CSV via raw.githubusercontent.com (CORS-friendly).
  // CSV columns: Date,VIX Open,VIX High,VIX Low,VIX Close
  const url = "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv";
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
  return { value: last.value, asOf: last.date, history, source: "live" };
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
          return { upper: json.upper, lower: json.lower, sourceLabel: "FRED (proxy)" };
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
  const { upper, lower } = await fetchFedSeries();
  const last     = upper[upper.length - 1];
  const lastLow  = lower[lower.length - 1] || last;
  const sixMo    = upper.slice(-180);
  const sixMoMA  = sixMo.reduce((a, p) => a + p.value, 0) / sixMo.length;

  const dot = await fetch("data/dotplot.json").then(r => r.json());
  const projections = dot.projections || {};
  // Backwards-compat: derive next-year median if projections missing.
  const ye = projections[String(new Date().getFullYear())] ?? dot.median_projection_year_end ?? last.value;

  return {
    current: last.value,
    currentUpper: last.value,
    currentLow:  lastLow.value,
    sixMoMA,
    projections,
    dotMedianYearEnd: ye,
    direction: dot.direction,
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
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const m3 = _compute3M(r.value.prices);
    if (m3 != null) closes[tickers[i]] = m3;
  });
  if (closes["SPY"] == null) throw new Error("SPY 3M close missing");
  const spy = closes["SPY"];
  const allRanked = Object.keys(SECTOR_ETFS)
    .filter(t => closes[t] != null)
    .map(t => ({
      ticker: t,
      name: SECTOR_ETFS[t],
      absReturn3M: closes[t],
      relStrength3M: closes[t] - spy
    }))
    .sort((a, b) => b.relStrength3M - a.relStrength3M);
  if (allRanked.length < 2) throw new Error("Not enough sector data");
  const top = allRanked[0], second = allRanked[1];
  return {
    topTicker: top.ticker, topName: top.name,
    absReturn3M: top.absReturn3M,
    relStrength3M: top.relStrength3M,
    spy3M: spy,
    runnerUp: { ticker: second.ticker, name: second.name, absReturn3M: second.absReturn3M, relStrength3M: second.relStrength3M },
    decisive: (top.relStrength3M - second.relStrength3M) >= 3,
    allRanked,
    source: "live"
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
  let beats = 0, total = 0, upwardSum = 0;
  results.forEach((r, i) => {
    const ticker = tickers[i];
    if (r.status !== "fulfilled" || !r.value || !r.value.latest) {
      perTicker.push({ ticker, actual: null, estimate: null, surprise: null, beat: false });
      return;
    }
    const latest = r.value.latest;
    const beat   = Boolean(latest.beat);
    total++;
    if (beat) beats++;
    perTicker.push({
      ticker,
      actual:   latest.actual,
      estimate: latest.estimate,
      surprise: latest.surprise,
      beat
    });
    const last4 = (r.value.history || []).slice(0, 4);
    upwardSum += last4.filter(q => q.beat).length;
  });

  if (total === 0) throw new Error("No earnings data returned for any constituent");
  return {
    sectorTicker,
    beatRate: beats / total,
    quartersUpward: Math.round(upwardSum / Math.max(1, total)),
    sample: total,
    perTicker,
    source: "live"
  };
}

// ============================================================
// Orchestration
// ============================================================
async function withFallback(name, fn, fallback) {
  try { return await fn(); }
  catch (err) {
    console.warn(`[${name}] live fetch failed, using mock:`, err.message || err);
    return { ...fallback, source: "mock" };
  }
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
  renderScore(score);
  renderVIXDetail(data.vix, results[0]);
  renderFedDetail(data.fed, results[1]);
  renderMarginDetail(data.margin, results[2]);
  renderSectorsDetail(data.leadingSector, results[3]);
  renderEarningsDetail(data.earnings, results[4]);

  document.getElementById("last-updated").textContent =
    `Updated ${new Date().toISOString().slice(0, 10)}`;
  document.getElementById("data-mode").textContent = data.dataMode;

  try {
    const history = await fetch("data/history.json").then(r => r.json());
    await renderHistory(history.points, new Date().toISOString(), score);
  } catch (err) {
    console.warn("history.json load failed:", err);
  }
}

main();
