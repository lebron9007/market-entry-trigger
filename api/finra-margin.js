// Vercel serverless function: returns FINRA's Debit Balances in Customers'
// Securities Margin Accounts as JSON in $ billions.
//
// Endpoint: /api/finra-margin
// Response: { unitsLabel: "$B", asOf: "YYYY-MM", history: [{ month, value }, ...] }
//
// FINRA's site is behind Cloudflare's bot protection — direct server-side
// fetch returns the "Just a moment…" challenge page (HTTP 403). We route
// through r.jina.ai, a free Reader proxy designed for LLM/scraper content
// extraction. It solves the Cloudflare challenge and returns the page as
// clean markdown like:
//
//   Mar-26 | 1,220,922 | 221,860 | 205,600
//
// which is trivial to regex.

const FINRA_URL =
  "https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics";
const JINA_READER = `https://r.jina.ai/${FINRA_URL}`;

const MONTH_ABBR = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

export default async function handler(req, res) {
  try {
    const r = await fetch(JINA_READER, {
      headers: {
        "User-Agent":
          "MarketEntryTrigger/1.0 (+https://market-entry-trigger.vercel.app)",
        Accept: "text/plain, text/markdown"
      }
    });
    if (!r.ok) {
      let snippet = "";
      try {
        const body = await r.text();
        snippet = body.slice(0, 200).replace(/\s+/g, " ");
      } catch (_) {}
      return res
        .status(502)
        .json({ error: `Jina reader HTTP ${r.status}`, snippet });
    }
    const text = await r.text();

    // Match data rows: "<Mon>-<YY> | <comma-separated number>"
    // First numeric column on each row IS the Debit Balances figure (millions).
    const rowRegex = /\b([A-Za-z]{3})-(\d{2})\s*\|\s*([\d,]+)/g;
    const seen = new Set();
    const history = [];
    let m;
    while ((m = rowRegex.exec(text)) !== null) {
      const mm = MONTH_ABBR[m[1].toLowerCase()];
      if (!mm) continue;
      const yr = (parseInt(m[2]) > 70 ? "19" : "20") + m[2];
      const month = `${yr}-${mm}`;
      if (seen.has(month)) continue;
      const valueMillions = parseFloat(m[3].replace(/,/g, ""));
      if (isNaN(valueMillions) || valueMillions <= 0) continue;
      seen.add(month);
      history.push({ month, value: +(valueMillions / 1000).toFixed(1) });
    }

    if (history.length === 0) {
      return res
        .status(502)
        .json({ error: "No data rows parsed from Jina-proxied FINRA content" });
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
