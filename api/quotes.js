// Vercel serverless function: proxies Yahoo Finance chart endpoint server-side.
// Server-to-server calls have no CORS, so we can pull split- and dividend-adjusted
// prices and serve them back to the browser with our own CORS headers.
//
// Endpoint: /api/quotes?ticker=NVDA&range=1y
// Response: { ticker, rows: [{ date: "YYYY-MM-DD", close: number }, ...] }

export default async function handler(req, res) {
  const ticker = (req.query.ticker || "").trim();
  const range = (req.query.range || "1y").trim();

  // Basic input validation — letters, digits, ^, ., -, =
  if (!ticker || !/^[A-Za-z0-9^.\-=]{1,15}$/.test(ticker)) {
    return res.status(400).json({ error: "invalid ticker" });
  }
  if (!/^(1mo|3mo|6mo|ytd|1y|2y|5y|10y|max)$/.test(range)) {
    return res.status(400).json({ error: "invalid range" });
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?range=${range}&interval=1d&includeAdjustedClose=true`;

  try {
    const upstream = await fetch(url, {
      headers: {
        // Yahoo sometimes 401s an empty UA; mimic a normal browser.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json"
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `yahoo ${upstream.status}`,
        ticker
      });
    }

    const data = await upstream.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return res.status(404).json({ error: "no result", ticker });
    }

    const ts = result.timestamp || [];
    // Use RAW close prices — matches Yahoo Finance UI "1Y change %" exactly.
    // adjclose includes dividend reinvestment (total return), which causes
    // dividend-paying stocks to look higher than what users see on Yahoo.
    // Trade-off: stocks with a split inside the window will be wrong (rare).
    const close = result.indicators?.quote?.[0]?.close || [];
    // Fallback to adjclose only if raw close is empty.
    const series = close.length ? close : (result.indicators?.adjclose?.[0]?.adjclose || []);

    const rows = ts
      .map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close: series[i]
      }))
      .filter(r => r.close != null && !isNaN(r.close));

    // Edge-cached 1h, stale-while-revalidate for a day.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ ticker, range, rows });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err), ticker });
  }
}
