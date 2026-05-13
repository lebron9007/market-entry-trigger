// Vercel serverless function: scrapes FINRA's monthly margin statistics page
// (Debit Balances in Customers' Securities Margin Accounts) and returns
// the time series as JSON in $ billions.
//
// Endpoint: /api/finra-margin
// Response: { unitsLabel: "$B", history: [{ month: "YYYY-MM", value: number }, ...], asOf: "YYYY-MM" }
//
// FINRA publishes around the 3rd week of each month for the prior month.
// We cache 1 day at the edge.

import { parse } from "node-html-parser";

const FINRA_URL =
  "https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics";

const MONTH_ABBR = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};
const MONTH_FULL = {
  january: "01", february: "02", march: "03", april: "04",
  june: "06", july: "07", august: "08", september: "09",
  october: "10", november: "11", december: "12"
};

function normalizeMonth(s) {
  if (!s) return null;
  const trimmed = s.trim();

  // "Mar-26" or "Mar 2026" → "YYYY-MM"
  let m = trimmed.match(/^([A-Za-z]+)[-\s]+(\d{2,4})$/);
  if (m) {
    const monKey = m[1].toLowerCase();
    const mm = MONTH_ABBR[monKey.slice(0, 3)] || MONTH_FULL[monKey];
    if (!mm) return null;
    let yr = m[2];
    if (yr.length === 2) yr = (parseInt(yr) > 70 ? "19" : "20") + yr;
    return `${yr}-${mm}`;
  }

  // Already "YYYY-MM" or "YYYY-MM-DD"
  m = trimmed.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;

  return null;
}

function parseValue(s) {
  if (!s) return NaN;
  // "$1,220,922" or "1,220,922" → number
  const cleaned = s.replace(/[$,\s]/g, "");
  return parseFloat(cleaned);
}

export default async function handler(req, res) {
  try {
    const r = await fetch(FINRA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*"
      }
    });
    if (!r.ok) throw new Error(`FINRA HTTP ${r.status}`);
    const html = await r.text();
    const root = parse(html);

    // Find the table whose header includes "Debit Balances".
    const tables = root.querySelectorAll("table");
    let target = null;
    let debitColIdx = -1;
    let monthColIdx = 0;

    for (const t of tables) {
      const headerRow = t.querySelector("thead tr") || t.querySelector("tr");
      if (!headerRow) continue;
      const headers = headerRow
        .querySelectorAll("th, td")
        .map(c => c.text.trim().toLowerCase());
      const dIdx = headers.findIndex(h => h.includes("debit balance"));
      if (dIdx === -1) continue;
      const mIdx = headers.findIndex(
        h => h.includes("month") || h.includes("year") || h.includes("date")
      );
      target = t;
      debitColIdx = dIdx;
      monthColIdx = mIdx >= 0 ? mIdx : 0;
      break;
    }
    if (!target) throw new Error("FINRA debit-balance table not found");

    // Parse all rows (skip the header row if it lives in tbody).
    const bodyRows = target.querySelectorAll("tbody tr");
    const rows = bodyRows.length
      ? bodyRows
      : target.querySelectorAll("tr").slice(1);

    const history = [];
    for (const row of rows) {
      const cells = row.querySelectorAll("td").map(c => c.text.trim());
      if (cells.length <= Math.max(monthColIdx, debitColIdx)) continue;
      const month = normalizeMonth(cells[monthColIdx]);
      const valueMillions = parseValue(cells[debitColIdx]);
      if (!month || isNaN(valueMillions)) continue;
      // FINRA reports in $ millions; convert to billions for display parity.
      history.push({ month, value: +(valueMillions / 1000).toFixed(1) });
    }

    if (history.length === 0) {
      throw new Error("FINRA table parsed but no valid rows");
    }

    // Sort chronologically (oldest → newest).
    history.sort((a, b) => a.month.localeCompare(b.month));
    const asOf = history[history.length - 1].month;

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ unitsLabel: "$B", asOf, history });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
