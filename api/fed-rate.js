// Vercel serverless function: proxies FRED's public CSV endpoints for the
// Fed Funds target rate (upper/lower bounds) AND the FOMC Summary of Economic
// Projections dot-plot medians. Server-to-server bypasses CORS.
//
// Endpoint: /api/fed-rate
// Response: {
//   upper: [{date, value}], lower: [{date, value}],
//   projections: { "2026": 3.6, "2027": 3.1, ..., long_run: 3.0 }   // dot plot
// }
//
// Dot-plot series:
//   FEDTARMD   — median projected fed funds rate, one obs per projection year
//   FEDTARMDLR — median projected longer-run rate
// Both refresh after each quarterly SEP release, so the dot plot is now
// automated instead of hand-maintained in data/dotplot.json.

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

    // Dot-plot medians — best-effort; if these fail the client falls back to
    // data/dotplot.json, so don't let a projection error break the rate data.
    const projections = {};
    try {
      const thisYear = new Date().getFullYear();
      const [med, lr] = await Promise.all([
        fetchFredSeries("FEDTARMD"),
        fetchFredSeries("FEDTARMDLR")
      ]);
      // FEDTARMD: one observation per projection target year. Keep forward
      // years (>= current year); key by year.
      for (const row of med) {
        const yr = parseInt(row.date.slice(0, 4));
        if (yr >= thisYear) projections[String(yr)] = row.value;
      }
      if (lr.length) projections.long_run = lr[lr.length - 1].value;
    } catch (e) {
      // leave projections empty -> client uses dotplot.json fallback
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=43200, stale-while-revalidate=86400"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ upper, lower, projections });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
