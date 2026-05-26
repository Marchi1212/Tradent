// Watchlist: alle Assets die Claude täglich analysiert
// Breites Spektrum für maximale Performance

import type { SessionId } from "./sessions";

export interface WatchlistAsset {
  symbol: string;   // Yahoo Finance Symbol
  name: string;     // Anzeigename
  ticker: string;   // XTB Ticker
  category: string; // Index, Aktie, Forex, Rohstoff
  market: string;   // Handelsplatz
  sessions: SessionId[]; // In welchen Runden analysiert
}

export const WATCHLIST: WatchlistAsset[] = [
  // ── Indizes (8) ──
  { symbol: "^GDAXI", name: "DAX 40", ticker: "DE40", category: "Index", market: "XETRA", sessions: ["eu"] },
  { symbol: "^FTSE", name: "FTSE 100", ticker: "UK100", category: "Index", market: "LSE", sessions: ["eu"] },
  { symbol: "^FCHI", name: "CAC 40", ticker: "FRA40", category: "Index", market: "XETRA", sessions: ["eu"] },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", ticker: "EU50", category: "Index", market: "XETRA", sessions: ["eu"] },
  { symbol: "^N225", name: "Nikkei 225", ticker: "JAP225", category: "Index", market: "JPX", sessions: ["eu"] },
  { symbol: "^GSPC", name: "S&P 500", ticker: "US500", category: "Index", market: "NYSE", sessions: ["us"] },
  { symbol: "^NDX", name: "NASDAQ 100", ticker: "US100", category: "Index", market: "NYSE", sessions: ["us"] },
  { symbol: "^DJI", name: "Dow Jones", ticker: "US30", category: "Index", market: "NYSE", sessions: ["us"] },

  // ── EU-Aktien (6) – XETRA Börsenzeiten ──
  { symbol: "SAP.DE", name: "SAP", ticker: "SAP.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "SIE.DE", name: "Siemens", ticker: "SIE.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "ASML.AS", name: "ASML", ticker: "ASML.NL", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "MC.PA", name: "LVMH", ticker: "LVMH.FR", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "VOW3.DE", name: "Volkswagen", ticker: "VOW.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "DBK.DE", name: "Deutsche Bank", ticker: "DBK.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },

  // ── US-Aktien (15) – NYSE Börsenzeiten ──
  { symbol: "TSLA", name: "Tesla", ticker: "TSLA.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "NVDA", name: "Nvidia", ticker: "NVDA.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "AAPL", name: "Apple", ticker: "AAPL.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "MSFT", name: "Microsoft", ticker: "MSFT.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "AMZN", name: "Amazon", ticker: "AMZN.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "META", name: "Meta", ticker: "META.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "GOOGL", name: "Alphabet", ticker: "GOOGL.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "AMD", name: "AMD", ticker: "AMD.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "NFLX", name: "Netflix", ticker: "NFLX.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "INTC", name: "Intel", ticker: "INTC.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "BA", name: "Boeing", ticker: "BA.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "JPM", name: "JPMorgan", ticker: "JPM.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "GS", name: "Goldman Sachs", ticker: "GS.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "DIS", name: "Disney", ticker: "DIS.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "KO", name: "Coca-Cola", ticker: "KO.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },

  // ── Forex (8) – beide Runden ──
  { symbol: "EURUSD=X", name: "EUR/USD", ticker: "EURUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "GBPUSD=X", name: "GBP/USD", ticker: "GBPUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "USDJPY=X", name: "USD/JPY", ticker: "USDJPY", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "USDCHF=X", name: "USD/CHF", ticker: "USDCHF", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "EURGBP=X", name: "EUR/GBP", ticker: "EURGBP", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "AUDUSD=X", name: "AUD/USD", ticker: "AUDUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "USDCAD=X", name: "USD/CAD", ticker: "USDCAD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "NZDUSD=X", name: "NZD/USD", ticker: "NZDUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },

  // ── Rohstoffe (6) – beide Runden ──
  { symbol: "GC=F", name: "Gold", ticker: "GOLD", category: "Rohstoff", market: "COMEX", sessions: ["eu", "us"] },
  { symbol: "SI=F", name: "Silber", ticker: "SILVER", category: "Rohstoff", market: "COMEX", sessions: ["eu", "us"] },
  { symbol: "PL=F", name: "Platin", ticker: "PLATINUM", category: "Rohstoff", market: "COMEX", sessions: ["eu", "us"] },
  { symbol: "CL=F", name: "Öl (WTI)", ticker: "OIL.WTI", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },
  { symbol: "BZ=F", name: "Öl (Brent)", ticker: "OIL", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },
  { symbol: "NG=F", name: "Erdgas", ticker: "NATGAS", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },

  // ── Krypto (12) – beide Runden, am Wochenende exklusiv ──
  { symbol: "BTC-USD", name: "Bitcoin", ticker: "BITCOIN", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "ETH-USD", name: "Ethereum", ticker: "ETHEREUM", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "SOL-USD", name: "Solana", ticker: "SOLANA", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "XRP-USD", name: "Ripple", ticker: "RIPPLE", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "ADA-USD", name: "Cardano", ticker: "CARDANO", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "DOT-USD", name: "Polkadot", ticker: "POLKADOT", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "LINK-USD", name: "Chainlink", ticker: "CHAINLINK", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "AVAX-USD", name: "Avalanche", ticker: "AVALANCHE", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "LTC-USD", name: "Litecoin", ticker: "LITECOIN", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "DOGE-USD", name: "Dogecoin", ticker: "DOGECOIN", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "MATIC-USD", name: "Polygon", ticker: "POLYGON", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
  { symbol: "UNI7083-USD", name: "Uniswap", ticker: "UNISWAP", category: "Krypto", market: "Krypto", sessions: ["eu", "us"] },
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

// Nur Crypto-Assets laden (für Wochenende)
export async function fetchCryptoMarketData(): Promise<AssetMarketData[]> {
  const cryptoAssets = WATCHLIST.filter((a) => a.category === "Krypto");
  return fetchAssetBatch(cryptoAssets);
}

// Alle Assets OHNE XETRA laden (für deutsche Feiertage: US/Forex/Rohstoffe/Crypto offen)
export async function fetchNonXetraMarketData(): Promise<AssetMarketData[]> {
  const nonXetra = WATCHLIST.filter((a) => !["XETRA", "XETRA_STOCK", "LSE", "JPX"].includes(a.market));
  return fetchAssetBatch(nonXetra);
}

// Nur Forex + Rohstoffe + Krypto (für Doppel-Feiertage: EU + US geschlossen)
export async function fetchGlobalMarketData(): Promise<AssetMarketData[]> {
  const global = WATCHLIST.filter((a) => ["Forex", "COMEX", "NYMEX", "Krypto"].includes(a.market));
  return fetchAssetBatch(global);
}

// Nur Forex + Krypto (für Doppel-Feiertage: CME auch geschlossen)
export async function fetchForexAndCryptoData(): Promise<AssetMarketData[]> {
  const fxCrypto = WATCHLIST.filter((a) => ["Forex", "Krypto"].includes(a.market));
  return fetchAssetBatch(fxCrypto);
}

// Alle Assets OHNE US laden (für US-Feiertage: EU/Forex/Rohstoffe/Crypto offen)
export async function fetchNonUSMarketData(): Promise<AssetMarketData[]> {
  const nonUS = WATCHLIST.filter((a) => !["NYSE", "NYSE_STOCK"].includes(a.market));
  return fetchAssetBatch(nonUS);
}

// Generische Batch-Loader-Funktion
async function fetchAssetBatch(assets: WatchlistAsset[]): Promise<AssetMarketData[]> {
  const results: AssetMarketData[] = [];
  const batchSize = 8;

  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fetchSingleAsset));

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }

    if (i + batchSize < assets.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

// Assets für eine Session parallel laden
export async function fetchMarketDataForSession(session: SessionId): Promise<AssetMarketData[]> {
  const filtered = WATCHLIST.filter((a) => a.sessions.includes(session));
  return fetchAssetBatch(filtered);
}
