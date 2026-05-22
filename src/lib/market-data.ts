// Watchlist: alle Assets die Claude täglich analysiert
// Breites Spektrum für maximale Performance

export interface WatchlistAsset {
  symbol: string;   // Yahoo Finance Symbol
  name: string;     // Anzeigename
  ticker: string;   // XTB Ticker
  category: string; // Index, Aktie, Forex, Rohstoff
  market: string;   // Handelsplatz
}

export const WATCHLIST: WatchlistAsset[] = [
  // Indizes
  { symbol: "^GDAXI", name: "DAX 40", ticker: "DE40", category: "Index", market: "XETRA" },
  { symbol: "^GSPC", name: "S&P 500", ticker: "US500", category: "Index", market: "NYSE" },
  { symbol: "^NDX", name: "NASDAQ 100", ticker: "US100", category: "Index", market: "NYSE" },
  { symbol: "^DJI", name: "Dow Jones", ticker: "US30", category: "Index", market: "NYSE" },

  // US-Aktien
  { symbol: "TSLA", name: "Tesla", ticker: "TSLA.US", category: "Aktie", market: "NYSE" },
  { symbol: "AAPL", name: "Apple", ticker: "AAPL.US", category: "Aktie", market: "NYSE" },
  { symbol: "NVDA", name: "Nvidia", ticker: "NVDA.US", category: "Aktie", market: "NYSE" },
  { symbol: "MSFT", name: "Microsoft", ticker: "MSFT.US", category: "Aktie", market: "NYSE" },
  { symbol: "AMZN", name: "Amazon", ticker: "AMZN.US", category: "Aktie", market: "NYSE" },
  { symbol: "META", name: "Meta", ticker: "META.US", category: "Aktie", market: "NYSE" },
  { symbol: "GOOGL", name: "Alphabet", ticker: "GOOGL.US", category: "Aktie", market: "NYSE" },
  { symbol: "AMD", name: "AMD", ticker: "AMD.US", category: "Aktie", market: "NYSE" },

  // EU-Aktien
  { symbol: "SAP.DE", name: "SAP", ticker: "SAP.DE", category: "Aktie", market: "XETRA" },
  { symbol: "SIE.DE", name: "Siemens", ticker: "SIE.DE", category: "Aktie", market: "XETRA" },

  // Forex
  { symbol: "EURUSD=X", name: "EUR/USD", ticker: "EURUSD", category: "Forex", market: "Forex" },
  { symbol: "GBPUSD=X", name: "GBP/USD", ticker: "GBPUSD", category: "Forex", market: "Forex" },
  { symbol: "USDJPY=X", name: "USD/JPY", ticker: "USDJPY", category: "Forex", market: "Forex" },

  // Rohstoffe
  { symbol: "GC=F", name: "Gold", ticker: "GOLD", category: "Rohstoff", market: "COMEX" },
  { symbol: "CL=F", name: "Öl (WTI)", ticker: "OIL.WTI", category: "Rohstoff", market: "NYMEX" },
  { symbol: "SI=F", name: "Silber", ticker: "SILVER", category: "Rohstoff", market: "COMEX" },
];

export interface AssetMarketData {
  name: string;
  ticker: string;
  category: string;
  market: string;
  currentPrice: number;
  change1dPercent: number;
  change5dPercent: number;
  high5d: number;
  low5d: number;
  sma20: number | null;
  rsi14: number | null;
}

// RSI berechnen (14 Perioden)
function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

// Simple Moving Average
function calculateSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return Math.round((slice.reduce((a, b) => a + b, 0) / period) * 100) / 100;
}

// Einzelnes Asset von Yahoo Finance laden
async function fetchSingleAsset(asset: WatchlistAsset): Promise<AssetMarketData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}?interval=1d&range=1mo&includePrePost=false`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const closes: number[] = (result.indicators?.quote?.[0]?.close || []).filter(
      (c: number | null) => c != null
    );
    const highs: number[] = (result.indicators?.quote?.[0]?.high || []).filter(
      (h: number | null) => h != null
    );
    const lows: number[] = (result.indicators?.quote?.[0]?.low || []).filter(
      (l: number | null) => l != null
    );

    if (closes.length < 5) return null;

    const currentPrice = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];
    const close5dAgo = closes.length >= 6 ? closes[closes.length - 6] : closes[0];

    const last5Highs = highs.slice(-5);
    const last5Lows = lows.slice(-5);

    return {
      name: asset.name,
      ticker: asset.ticker,
      category: asset.category,
      market: asset.market,
      currentPrice: Math.round(currentPrice * 100) / 100,
      change1dPercent: Math.round(((currentPrice - prevClose) / prevClose) * 10000) / 100,
      change5dPercent: Math.round(((currentPrice - close5dAgo) / close5dAgo) * 10000) / 100,
      high5d: Math.round(Math.max(...last5Highs) * 100) / 100,
      low5d: Math.round(Math.min(...last5Lows) * 100) / 100,
      sma20: calculateSMA(closes, 20),
      rsi14: calculateRSI(closes),
    };
  } catch (err) {
    console.error(`Marktdaten für ${asset.symbol} fehlgeschlagen:`, err);
    return null;
  }
}

// Alle Assets parallel laden (in Batches von 5)
export async function fetchAllMarketData(): Promise<AssetMarketData[]> {
  const results: AssetMarketData[] = [];
  const batchSize = 5;

  for (let i = 0; i < WATCHLIST.length; i += batchSize) {
    const batch = WATCHLIST.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fetchSingleAsset));

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }

    // Kurze Pause zwischen Batches
    if (i + batchSize < WATCHLIST.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
