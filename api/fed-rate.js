// Vercel serverless function: proxies FRED's public CSV endpoints for the
// Fed Funds target rate upper and lower bounds. Server-to-server bypasses
// CORS so the browser can pull live data without a key.
//
// Endpoint: /api/fed-rate
// Response: { upper: [{date, value}, ...], lower: [{date, value}, ...] }

async function fetchFredSeries(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MarketEntryTrigger/1.0; +https://market-entry-trigger.vercel.app)",
      Accept: "text/csv,*/*"
    }
  });
  if (!r.ok) throw new Error(`FRED ${seriesId} HTTP ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split("\n").slice(1); // skip header
  return lines
    .map(line => {
      const parts = line.split(",");
      return { date: (parts[0] || "").trim(), value: parseFloat(parts[1]) };
    })
    .filter(r => r.date && !isNaN(r.value));
}

export default async function handler(req, res) {
  try {
    const [upper, lower] = await Promise.all([
      fetchFredSeries("DFEDTARU"),
      fetchFredSeries("DFEDTARL")
    ]);

    if (upper.length === 0 || lower.length === 0) {
      throw new Error("FRED returned no observations");
    }

    // Edge-cached 12h, stale-while-revalidate 1 day. DFEDTARU/L only change
    // on FOMC days so this is plenty.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=43200, stale-while-revalidate=86400"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ upper, lower });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
