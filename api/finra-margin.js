// Vercel serverless function: scrapes FINRA's monthly margin statistics page
// (Debit Balances in Customers' Securities Margin Accounts) and returns
// the time series as JSON in $ billions.
//
// Endpoint: /api/finra-margin
// Response: { unitsLabel: "$B", asOf: "YYYY-MM", history: [{ month, value }, ...] }
//
// Implementation uses plain regex over the static HTML (no DOM parser
// dependency) so the function has zero install-time risk on Vercel.
// FINRA's table has a stable, simple structure: one <tr> per month, with
// "Mar-26"-style date in the first cell and comma-separated millions
// in the second cell. Filtering by date format rejects all non-data rows.

const FINRA_URL =
  "https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics";

const MONTH_ABBR = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

// Accepts "Mar-26", "Mar 2026", "Mar-2026" → "YYYY-MM"
function normalizeMonth(s) {
  if (!s) return null;
  const trimmed = s.trim();
  const m = trimmed.match(/^([A-Za-z]{3,9})[-\s]+(\d{2,4})$/);
  if (!m) return null;
  const mm = MONTH_ABBR[m[1].toLowerCase().slice(0, 3)];
  if (!mm) return null;
  let yr = m[2];
  if (yr.length === 2) yr = (parseInt(yr) > 70 ? "19" : "20") + yr;
  return `${yr}-${mm}`;
}

// "1,220,922" → 1220922  (or NaN)
function parseValue(s) {
  if (!s) return NaN;
  const cleaned = s.replace(/[$,\s]/g, "");
  return parseFloat(cleaned);
}

// Strip HTML tags and decode minimal entities
function stripTags(s) {
  return s.replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .trim();
}

export default async function handler(req, res) {
  try {
    // Full browser-like header set — FINRA's CDN (Akamai) rejects requests
    // that look like obvious bots. The combination below has been observed
    // to satisfy most bot-detection layers.
    const r = await fetch(FINRA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9," +
          "image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      },
      redirect: "follow"
    });
    if (!r.ok) {
      // Capture a snippet of the body so we can tell whether we're seeing a
      // CDN block page (Akamai/Cloudflare) vs an actual server error.
      let snippet = "";
      try {
        const body = await r.text();
        snippet = body.slice(0, 200).replace(/\s+/g, " ");
      } catch (_) {}
      return res.status(502).json({
        error: `FINRA upstream HTTP ${r.status}`,
        snippet
      });
    }
    const html = await r.text();

    // Iterate every <tr>...</tr> block; extract cells; keep rows whose first
    // cell looks like a month date (this is the unambiguous signal).
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g;

    const history = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const cells = [];
      let cellMatch;
      cellRegex.lastIndex = 0;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(stripTags(cellMatch[1]));
      }
      if (cells.length < 2) continue;
      const month = normalizeMonth(cells[0]);
      if (!month) continue;                           // header & misc rows skipped here
      const valueMillions = parseValue(cells[1]);     // "Debit Balances" col
      if (isNaN(valueMillions)) continue;
      history.push({ month, value: +(valueMillions / 1000).toFixed(1) });
    }

    if (history.length === 0) {
      return res.status(502).json({
        error: "No data rows found in FINRA HTML — page structure may have changed"
      });
    }

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
