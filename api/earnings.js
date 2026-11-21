// Vercel serverless function: returns per-ticker quarterly earnings history
// (EPS estimate vs actual).
//
// Endpoint: /api/earnings?ticker=NVDA
// Response: { ticker, provider, latest: {...}, history: [...] }   (newest first)
//
// PRIMARY: Yahoo Finance quoteSummary "earningsHistory" module — consensus
// EPS estimate vs reported EPS for the last 4 quarters. No API key, but the
// endpoint requires a session "crumb": the same cookie + token handshake the
// Yahoo Finance website performs on page load (fc.yahoo.com sets the cookie,
// /v1/test/getcrumb returns the token). The pair is cached per warm instance.
//
// FALLBACK: MarketBeat earnings page via r.jina.ai. Since Nov 2026 MarketBeat
// serves a Cloudflare challenge to the proxy, so this rarely succeeds now.
//
// Edge-cached 7 days per ticker (earnings are quarterly).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ---------------------------------------------------------------- Yahoo
let yahooSession = null; // { cookie, crumb, at }
const SESSION_TTL_MS = 60 * 60 * 1000;

function extractCookies(resp) {
  const list = typeof resp.headers.getSetCookie === "function"
    ? resp.headers.getSetCookie()
    : (resp.headers.get("set-cookie") || "").split(/,(?=\s*[A-Za-z0-9_]+=)/);
  return list.map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

async function getYahooSession(force = false) {
  if (!force && yahooSession && Date.now() - yahooSession.at < SESSION_TTL_MS) {
    return yahooSession;
  }
  const r1 = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA }, redirect: "manual" });
  const cookie = extractCookies(r1);
  if (!cookie) throw new Error("Yahoo: no session cookie");
  const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie }
  });
  const crumb = (await r2.text()).trim();
  if (!r2.ok || !crumb || crumb.length > 64 || /[<{\s]/.test(crumb)) {
    throw new Error(`Yahoo: crumb HTTP ${r2.status}`);
  }
  yahooSession = { cookie, crumb, at: Date.now() };
  return yahooSession;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function quarterLabel(isoDate) {
  // "2026-10-26" -> "Qtr ending Oct 2026". Fiscal quarters don't line up
  // with calendar quarters (e.g. NVDA), so name the period by its end month.
  const [y, m] = isoDate.split("-").map(Number);
  return `Qtr ending ${MONTHS[m - 1]} ${y}`;
}

async function fetchYahooEarnings(ticker) {
  const attempt = async (session) => {
    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
      `?modules=earningsHistory&crumb=${encodeURIComponent(session.crumb)}`;
    return fetch(url, { headers: { "User-Agent": UA, Cookie: session.cookie, Accept: "application/json" } });
  };
  let r = await attempt(await getYahooSession());
  if (r.status === 401 || r.status === 403) r = await attempt(await getYahooSession(true));
  if (!r.ok) throw new Error(`Yahoo earningsHistory HTTP ${r.status}`);
  const j = await r.json();
  const rows = j?.quoteSummary?.result?.[0]?.earningsHistory?.history || [];
  return rows
    .map(q => {
      const estimate = q?.epsEstimate?.raw;
      const actual   = q?.epsActual?.raw;
      const date     = q?.quarter?.fmt; // fiscal quarter end, YYYY-MM-DD
      if (!Number.isFinite(estimate) || !Number.isFinite(actual) || !date) return null;
      return {
        date,
        quarter: quarterLabel(date),
        estimate: +estimate.toFixed(2),
        actual:   +actual.toFixed(2),
        surprise: estimate !== 0
          ? +(((actual - estimate) / Math.abs(estimate)) * 100).toFixed(2)
          : 0,
        beat: actual > estimate
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
}

// ----------------------------------------------------------- MarketBeat
const EXCHANGES = ["NASDAQ", "NYSE"];

async function fetchMarketBeatMarkdown(ticker) {
  for (const ex of EXCHANGES) {
    try {
      const url = `https://r.jina.ai/https://www.marketbeat.com/stocks/${ex}/${ticker}/earnings/`;
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "MarketEntryTrigger/1.0 (+https://market-entry-trigger.vercel.app)",
          Accept: "text/plain, text/markdown"
        }
      });
      if (!r.ok) continue;
      const text = await r.text();
      // Skip 404-style empty pages — must contain a row that looks like
      // "M/D/YYYY | Q# YYYY".
      if (text.length < 500) continue;
      if (/page you are looking for could not be found/i.test(text)) continue;
      if (!/\|\s*\d{1,2}\/\d{1,2}\/\d{4}[^|]*\|\s*Q\d\s+\d{4}/i.test(text)) continue;
      return text;
    } catch (_) { /* try next exchange */ }
  }
  throw new Error(`MarketBeat earnings page not found for ${ticker}`);
}

function parseEarningsMarkdown(text) {
  const history = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;

    const cells = line
      .split("|")
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (cells.length < 4) continue;

    const [dateCell, quarterCell, estCell, actCell] = cells;

    // First column must be a US date.
    const dm = dateCell.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) continue;

    // Skip rows where the actual EPS hasn't been reported yet.
    if (/^[—\-]$/.test(actCell)) continue;

    const estimate = parseFloat(estCell.replace(/[$,()]/g, ""));
    const actual   = parseFloat(actCell.replace(/[$,()]/g, ""));
    if (!Number.isFinite(estimate) || !Number.isFinite(actual)) continue;

    const beat     = actual > estimate;
    const surprise =
      estimate !== 0
        ? +(((actual - estimate) / Math.abs(estimate)) * 100).toFixed(2)
        : 0;
    const iso = `${dm[3]}-${dm[1].padStart(2, "0")}-${dm[2].padStart(2, "0")}`;

    history.push({
      date: iso,
      quarter: quarterCell,
      estimate,
      actual,
      surprise,
      beat
    });
  }
  return history;
}

// -------------------------------------------------------------- handler
export default async function handler(req, res) {
  const ticker = String(req.query?.ticker || "").toUpperCase().trim();
  if (!ticker || !/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
    return res.status(400).json({ error: "Missing or invalid ?ticker= parameter" });
  }

  let history = [];
  let provider = null;
  const errors = [];

  try {
    history = await fetchYahooEarnings(ticker);
    provider = "Yahoo";
  } catch (e) { errors.push(String(e.message || e)); }

  if (history.length === 0) {
    try {
      history = parseEarningsMarkdown(await fetchMarketBeatMarkdown(ticker));
      provider = "MarketBeat";
    } catch (e) { errors.push(String(e.message || e)); }
  }

  if (history.length === 0) {
    return res.status(502).json({ error: errors.join("; ") || `No earnings rows for ${ticker}` });
  }

  // Earnings only update quarterly — cache hard. 7-day edge cache,
  // 30-day stale-while-revalidate. Per-ticker keying via the URL.
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=604800, stale-while-revalidate=2592000"
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    ticker,
    provider,
    latest: history[0],
    history: history.slice(0, 8)
  });
}
