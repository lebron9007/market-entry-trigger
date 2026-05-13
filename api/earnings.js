// Vercel serverless function: returns per-ticker quarterly earnings history
// (EPS estimate vs actual) by scraping MarketBeat through r.jina.ai.
//
// Endpoint: /api/earnings?ticker=NVDA
// Response: { ticker, latest: {...}, history: [...] }
//
// MarketBeat publishes a clean quarterly earnings table per ticker at
//   https://www.marketbeat.com/stocks/<EXCHANGE>/<TICKER>/earnings/
// Direct fetch is bot-protected; routing through r.jina.ai (the LLM
// Reader proxy) returns the page as markdown with a parseable pipe-table:
//
//   | Date | Quarter | Consensus Estimate | Reported EPS | Beat/Miss |
//   | 2/25/2026 | Q4 2026 | $1.54 | $1.62 | +$0.08 |
//
// We try NASDAQ first, then NYSE, since MarketBeat splits its URL space
// by listing exchange. Edge-cached 7 days (earnings are quarterly).

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

export default async function handler(req, res) {
  const ticker = String(req.query?.ticker || "").toUpperCase().trim();
  if (!ticker || !/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
    return res.status(400).json({ error: "Missing or invalid ?ticker= parameter" });
  }

  try {
    const text    = await fetchMarketBeatMarkdown(ticker);
    const history = parseEarningsMarkdown(text);
    if (history.length === 0) {
      return res.status(502).json({ error: `No earnings rows parsed for ${ticker}` });
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
      latest: history[0],
      history: history.slice(0, 8)
    });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
