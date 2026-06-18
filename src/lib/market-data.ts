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
  // ── Indizes (10) ──
  { symbol: "^GDAXI", name: "DAX 40", ticker: "DE40", category: "Index", market: "XETRA", sessions: ["eu"] },
  { symbol: "^FTSE", name: "FTSE 100", ticker: "UK100", category: "Index", market: "LSE", sessions: ["eu"] },
  { symbol: "^FCHI", name: "CAC 40", ticker: "FRA40", category: "Index", market: "XETRA", sessions: ["eu"] },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", ticker: "EU50", category: "Index", market: "XETRA", sessions: ["eu"] },
  { symbol: "^N225", name: "Nikkei 225", ticker: "JAP225", category: "Index", market: "JPX", sessions: ["eu"] },
  { symbol: "^HSI", name: "Hang Seng", ticker: "HKComp", category: "Index", market: "JPX", sessions: ["eu"] },
  { symbol: "^GSPC", name: "S&P 500", ticker: "US500", category: "Index", market: "NYSE", sessions: ["us"] },
  { symbol: "^NDX", name: "NASDAQ 100", ticker: "US100", category: "Index", market: "NYSE", sessions: ["us"] },
  { symbol: "^DJI", name: "Dow Jones", ticker: "US30", category: "Index", market: "NYSE", sessions: ["us"] },
  { symbol: "^RUT", name: "Russell 2000", ticker: "US2000", category: "Index", market: "NYSE", sessions: ["us"] },

  // ── EU-Aktien (16) – XETRA Börsenzeiten ──
  { symbol: "SAP.DE", name: "SAP", ticker: "SAP.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "SIE.DE", name: "Siemens", ticker: "SIE.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "ASML.AS", name: "ASML", ticker: "ASML.NL", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "MC.PA", name: "LVMH", ticker: "LVMH.FR", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "VOW3.DE", name: "Volkswagen", ticker: "VOW.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "DBK.DE", name: "Deutsche Bank", ticker: "DBK.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "BMW.DE", name: "BMW", ticker: "BMW.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "AIR.PA", name: "Airbus", ticker: "AIR.FR", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "TTE.PA", name: "TotalEnergies", ticker: "TTE.FR", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "NESN.SW", name: "Nestlé", ticker: "NESN.CH", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "ALV.DE", name: "Allianz", ticker: "ALV.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "BAS.DE", name: "BASF", ticker: "BAS.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "DTE.DE", name: "Deutsche Telekom", ticker: "DTE.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "SAN.PA", name: "Sanofi", ticker: "SAN.FR", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "OR.PA", name: "L'Oréal", ticker: "ORP.FR", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },
  { symbol: "BAYN.DE", name: "Bayer", ticker: "BAYN.DE", category: "Aktie", market: "XETRA_STOCK", sessions: ["eu"] },

  // ── US-Aktien (25) – NYSE Börsenzeiten ──
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
  { symbol: "AVGO", name: "Broadcom", ticker: "AVGO.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "PLTR", name: "Palantir", ticker: "PLTR.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "UBER", name: "Uber", ticker: "UBER.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "CRM", name: "Salesforce", ticker: "CRM.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "V", name: "Visa", ticker: "V.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "XOM", name: "Exxon Mobil", ticker: "XOM.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "PFE", name: "Pfizer", ticker: "PFE.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "ABNB", name: "Airbnb", ticker: "ABNB.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "COIN", name: "Coinbase", ticker: "COIN.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },
  { symbol: "SNAP", name: "Snap", ticker: "SNAP.US", category: "Aktie", market: "NYSE_STOCK", sessions: ["us"] },

  // ── Forex (14) – beide Runden ──
  { symbol: "EURUSD=X", name: "EUR/USD", ticker: "EURUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "GBPUSD=X", name: "GBP/USD", ticker: "GBPUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "USDJPY=X", name: "USD/JPY", ticker: "USDJPY", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "USDCHF=X", name: "USD/CHF", ticker: "USDCHF", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "EURGBP=X", name: "EUR/GBP", ticker: "EURGBP", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "AUDUSD=X", name: "AUD/USD", ticker: "AUDUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "USDCAD=X", name: "USD/CAD", ticker: "USDCAD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "NZDUSD=X", name: "NZD/USD", ticker: "NZDUSD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "EURJPY=X", name: "EUR/JPY", ticker: "EURJPY", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "GBPJPY=X", name: "GBP/JPY", ticker: "GBPJPY", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "EURCHF=X", name: "EUR/CHF", ticker: "EURCHF", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "AUDJPY=X", name: "AUD/JPY", ticker: "AUDJPY", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "CADJPY=X", name: "CAD/JPY", ticker: "CADJPY", category: "Forex", market: "Forex", sessions: ["eu", "us"] },
  { symbol: "EURAUD=X", name: "EUR/AUD", ticker: "EURAUD", category: "Forex", market: "Forex", sessions: ["eu", "us"] },

  // ── Rohstoffe (10) – beide Runden ──
  { symbol: "GC=F", name: "Gold", ticker: "GOLD", category: "Rohstoff", market: "COMEX", sessions: ["eu", "us"] },
  { symbol: "SI=F", name: "Silber", ticker: "SILVER", category: "Rohstoff", market: "COMEX", sessions: ["eu", "us"] },
  { symbol: "PL=F", name: "Platin", ticker: "PLATINUM", category: "Rohstoff", market: "COMEX", sessions: ["eu", "us"] },
  { symbol: "HG=F", name: "Kupfer", ticker: "COPPER", category: "Rohstoff", market: "COMEX", sessions: ["eu", "us"] },
  { symbol: "CL=F", name: "Öl (WTI)", ticker: "OIL.WTI", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },
  { symbol: "BZ=F", name: "Öl (Brent)", ticker: "OIL", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },
  { symbol: "NG=F", name: "Erdgas", ticker: "NATGAS", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },
  { symbol: "ZW=F", name: "Weizen", ticker: "WHEAT", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },
  { symbol: "ZC=F", name: "Mais", ticker: "CORN", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },
  { symbol: "ZS=F", name: "Sojabohnen", ticker: "SOYBEAN", category: "Rohstoff", market: "NYMEX", sessions: ["eu", "us"] },

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
  atr14: number | null;
  atr14Percent: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  bollingerBands: { upper: number; lower: number; width: number } | null;
  volume: { current: number; avg20: number; ratio: number } | null;
  support: number | null;
  resistance: number | null;
}

export type SignalDirection = "LONG" | "SHORT" | null;

export interface ConfidenceResult {
  direction: SignalDirection;
  confidence: number;
  components: {
    momentum: number;
    trend: number;
    volume: number;
    penalties: number;
  };
  reasons: string[];
  filtered: boolean;
  filterReason?: string;
}

export function analyzeAsset(d: AssetMarketData): ConfidenceResult {
  const reasons: string[] = [];

  // ── FILTER ──
  if (d.rsi14 !== null && d.rsi14 >= 45 && d.rsi14 <= 55) {
    return { direction: null, confidence: 0, components: { momentum: 0, trend: 0, volume: 0, penalties: 0 }, reasons: [], filtered: true, filterReason: "RSI 45-55 (kein Signal)" };
  }
  if (d.atr14Percent !== null && d.atr14Percent < 0.2 && (d.category === "Index")) {
    return { direction: null, confidence: 0, components: { momentum: 0, trend: 0, volume: 0, penalties: 0 }, reasons: [], filtered: true, filterReason: "ATR zu niedrig für Index" };
  }
  if (d.atr14Percent !== null && d.atr14Percent < 0.5 && (d.category === "Rohstoff" || d.category === "Aktie")) {
    return { direction: null, confidence: 0, components: { momentum: 0, trend: 0, volume: 0, penalties: 0 }, reasons: [], filtered: true, filterReason: "ATR zu niedrig" };
  }
  if (d.atr14Percent !== null && d.atr14Percent < 0.3 && d.category !== "Index") {
    return { direction: null, confidence: 0, components: { momentum: 0, trend: 0, volume: 0, penalties: 0 }, reasons: [], filtered: true, filterReason: "ATR < 0.3%" };
  }
  if (d.volume && d.volume.ratio < 0.5) {
    return { direction: null, confidence: 0, components: { momentum: 0, trend: 0, volume: 0, penalties: 0 }, reasons: [], filtered: true, filterReason: "Volumen < 0.5x (kein Interesse)" };
  }

  // ── RICHTUNG ──
  let direction: SignalDirection = null;

  const belowSMA = d.sma20 !== null && d.currentPrice < d.sma20;
  const aboveSMA = d.sma20 !== null && d.currentPrice > d.sma20;
  const trendUp1d = d.change1dPercent > 0;
  const trendDown1d = d.change1dPercent < 0;

  if (d.rsi14 !== null) {
    if (d.rsi14 < 35 && belowSMA) direction = "LONG";
    else if (d.rsi14 > 65 && aboveSMA) direction = "SHORT";
    else if (d.rsi14 >= 35 && d.rsi14 < 45 && aboveSMA && trendUp1d) direction = "LONG";
    else if (d.rsi14 > 55 && d.rsi14 <= 65 && belowSMA && trendDown1d) direction = "SHORT";
  }

  if (direction === null) {
    return { direction: null, confidence: 0, components: { momentum: 0, trend: 0, volume: 0, penalties: 0 }, reasons: [], filtered: true, filterReason: "Keine klare Richtung" };
  }

  // MACD muss Richtung bestätigen
  if (d.macd) {
    const macdConfirms = (direction === "LONG" && d.macd.histogram > 0) || (direction === "SHORT" && d.macd.histogram < 0);
    if (!macdConfirms) {
      return { direction: null, confidence: 0, components: { momentum: 0, trend: 0, volume: 0, penalties: 0 }, reasons: [], filtered: true, filterReason: "MACD bestätigt Richtung nicht" };
    }
  }

  // ── KONFIDENZ (Basis 45%, gruppenbasiert mit Caps) ──
  let momentum = 0; // Cap: +20%
  let trend = 0;    // Cap: +15%
  let volume = 0;   // Cap: +10%
  let penalties = 0;

  // --- MOMENTUM-GRUPPE (RSI + MACD + Bollinger) — max +20% ---

  // RSI
  if (d.rsi14 !== null) {
    if (d.rsi14 < 25 || d.rsi14 > 75) { momentum += 12; reasons.push(`RSI ${d.rsi14} extrem`); }
    else if (d.rsi14 < 30 || d.rsi14 > 70) { momentum += 8; reasons.push(`RSI ${d.rsi14} stark`); }
    else { momentum += 3; reasons.push(`RSI ${d.rsi14}`); }
  }

  // MACD (schon bestätigt, jetzt Stärke)
  if (d.macd) {
    const histAbs = Math.abs(d.macd.histogram);
    const signalAbs = Math.abs(d.macd.signal);
    const growing = histAbs > signalAbs * 0.5;
    if (growing) { momentum += 6; reasons.push("MACD wächst"); }
    else { momentum += 3; reasons.push("MACD bestätigt"); }
  }

  // Bollinger
  if (d.bollingerBands) {
    const price = d.currentPrice;
    const { upper, lower } = d.bollingerBands;
    const outsideBand = price > upper || price < lower;
    const nearBand = (direction === "LONG" && price < lower * 1.02) || (direction === "SHORT" && price > upper * 0.98);

    if (outsideBand) {
      // Außerhalb Band: nur gut für Mean-Reversion, nicht für Trend-Fortsetzung
      const isMeanReversion = (direction === "LONG" && price < lower) || (direction === "SHORT" && price > upper);
      if (isMeanReversion) { momentum += 5; reasons.push("Außerhalb BB (Mean-Reversion)"); }
      else { penalties -= 5; reasons.push("Außerhalb BB gegen Richtung"); }
    } else if (nearBand) {
      momentum += 3; reasons.push("Nahe BB");
    }
  }

  // RSI-Extrem OHNE Volumen = Falle (Interaktionsregel)
  if (d.rsi14 !== null && (d.rsi14 < 30 || d.rsi14 > 70) && d.volume && d.volume.ratio < 1.0) {
    penalties -= 8;
    reasons.push("RSI-Extrem ohne Volumen (Falle-Risiko)");
  }

  momentum = Math.min(momentum, 20);

  // --- TREND-GRUPPE (SMA20 + Trend 1T/5T + S/R + 5T-Hoch/Tief) — max +15% ---

  // Trend-Bestätigung
  const trendConfirms = (direction === "LONG" && d.change1dPercent > 0 && d.change5dPercent > 0)
    || (direction === "SHORT" && d.change1dPercent < 0 && d.change5dPercent < 0);
  if (trendConfirms) { trend += 6; reasons.push("1T+5T Trend bestätigt"); }

  // SMA20-Alignment
  const smaAligned = (direction === "LONG" && belowSMA) || (direction === "SHORT" && aboveSMA);
  if (smaAligned) { trend += 3; reasons.push("SMA20 bestätigt"); }

  // Support/Resistance (nach ATR-Nähe gestaffelt)
  if (d.atr14 && d.atr14 > 0) {
    if (direction === "LONG" && d.support !== null) {
      const distToSupport = Math.abs(d.currentPrice - d.support) / d.atr14;
      if (distToSupport < 0.5) { trend += 6; reasons.push(`Sehr nahe Support (${distToSupport.toFixed(1)}x ATR)`); }
      else if (distToSupport < 1.0) { trend += 3; reasons.push(`Nahe Support (${distToSupport.toFixed(1)}x ATR)`); }
    }
    if (direction === "SHORT" && d.resistance !== null) {
      const distToResistance = Math.abs(d.resistance - d.currentPrice) / d.atr14;
      if (distToResistance < 0.5) { trend += 6; reasons.push(`Sehr nahe Resistance (${distToResistance.toFixed(1)}x ATR)`); }
      else if (distToResistance < 1.0) { trend += 3; reasons.push(`Nahe Resistance (${distToResistance.toFixed(1)}x ATR)`); }
    }
    // Gegen Level = Strafe
    if (direction === "LONG" && d.resistance !== null) {
      const distToResistance = Math.abs(d.resistance - d.currentPrice) / d.atr14;
      if (distToResistance < 0.5) { penalties -= 6; reasons.push("LONG direkt unter Resistance"); }
    }
    if (direction === "SHORT" && d.support !== null) {
      const distToSupport = Math.abs(d.currentPrice - d.support) / d.atr14;
      if (distToSupport < 0.5) { penalties -= 6; reasons.push("SHORT direkt über Support"); }
    }
  }

  // 5T-Hoch/Tief Breakout
  if (direction === "LONG" && d.currentPrice >= d.high5d * 0.99) {
    trend += 3; reasons.push("Nahe/über 5T-Hoch (Breakout)");
  }
  if (direction === "SHORT" && d.currentPrice <= d.low5d * 1.01) {
    trend += 3; reasons.push("Nahe/unter 5T-Tief (Breakout)");
  }

  trend = Math.min(trend, 15);

  // --- VOLUMEN-GRUPPE — max +10% ---
  if (d.volume) {
    const ratio = d.volume.ratio;
    if (ratio > 8.0) {
      // Extrem hohes Volumen = wahrscheinlich News-getrieben, unberechenbar
      volume += 3;
      penalties -= 5;
      reasons.push(`Volumen ${ratio}x extrem (News-Risiko)`);
    } else if (ratio > 5.0) { volume += 10; reasons.push(`Volumen ${ratio}x sehr stark`); }
    else if (ratio > 3.0) { volume += 7; reasons.push(`Volumen ${ratio}x stark`); }
    else if (ratio > 1.5) { volume += 4; reasons.push(`Volumen ${ratio}x gut`); }
    else if (ratio >= 1.0) { volume += 1; reasons.push(`Volumen ${ratio}x normal`); }
    else { penalties -= 3; reasons.push(`Volumen ${ratio}x schwach`); }
  }

  volume = Math.min(volume, 10);

  // --- PENALTIES ---

  // SMA20 gegen Richtung
  if ((direction === "LONG" && aboveSMA) || (direction === "SHORT" && belowSMA)) {
    penalties -= 5; reasons.push("Gegen SMA20-Trend");
  }

  // ATR zu hoch = unberechenbarer Markt
  if (d.atr14Percent !== null && d.atr14Percent > 5) {
    penalties -= 5; reasons.push(`ATR ${d.atr14Percent}% sehr volatil`);
  }

  // MACD wächst bei RSI-Extrem in Gegenrichtung = Erschöpfung
  if (d.rsi14 !== null && d.macd) {
    const exhaustion = (direction === "LONG" && d.rsi14 > 75 && d.macd.histogram > 0)
      || (direction === "SHORT" && d.rsi14 < 25 && d.macd.histogram < 0);
    if (exhaustion) {
      penalties -= 8;
      reasons.push("Erschöpfungssignal (RSI-Extrem + starkes Momentum)");
    }
  }

  const confidence = Math.max(40, Math.min(95, 45 + momentum + trend + volume + penalties));

  return {
    direction,
    confidence,
    components: { momentum, trend, volume, penalties },
    reasons,
    filtered: false,
  };
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

// Average True Range (14 Perioden)
function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / period;
  return Math.round(atr * 10000) / 10000;
}

// Simple Moving Average
function calculateSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return Math.round((slice.reduce((a, b) => a + b, 0) / period) * 100) / 100;
}

// MACD (12/26/9)
function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;

  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine.slice(26), 9);
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalLine[signalLine.length - 1];
  return {
    macd: Math.round(macdVal * 10000) / 10000,
    signal: Math.round(signalVal * 10000) / 10000,
    histogram: Math.round((macdVal - signalVal) * 10000) / 10000,
  };
}

// Bollinger Bands (20 Perioden, 2 Standardabweichungen)
function calculateBollinger(closes: number[]): { upper: number; lower: number; width: number } | null {
  if (closes.length < 20) return null;
  const slice = closes.slice(-20);
  const mean = slice.reduce((a, b) => a + b, 0) / 20;
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / 20;
  const stdDev = Math.sqrt(variance);
  const upper = Math.round((mean + 2 * stdDev) * 100) / 100;
  const lower = Math.round((mean - 2 * stdDev) * 100) / 100;
  const width = mean > 0 ? Math.round(((upper - lower) / mean) * 10000) / 100 : 0;
  return { upper, lower, width };
}

// Volumen-Analyse
function calculateVolume(volumes: number[]): { current: number; avg20: number; ratio: number } | null {
  if (volumes.length < 20) return null;
  const current = volumes[volumes.length - 1];
  const avg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (avg20 === 0) return null;
  return {
    current: Math.round(current),
    avg20: Math.round(avg20),
    ratio: Math.round((current / avg20) * 100) / 100,
  };
}

// Support/Resistance aus 30-Tage-Hochs/Tiefs
function calculateSupportResistance(highs: number[], lows: number[]): { support: number | null; resistance: number | null } {
  if (highs.length < 10 || lows.length < 10) return { support: null, resistance: null };
  const recentHighs = highs.slice(-30);
  const recentLows = lows.slice(-30);
  const resistance = Math.round(Math.max(...recentHighs) * 100) / 100;
  const support = Math.round(Math.min(...recentLows) * 100) / 100;
  return { support, resistance };
}

// Einzelnes Asset per XTB-Ticker laden (für Manage-Endpoint)
export async function fetchAssetByTicker(xbtTicker: string): Promise<AssetMarketData | null> {
  const asset = WATCHLIST.find(w => w.ticker === xbtTicker);
  if (!asset) return null;
  return fetchSingleAsset(asset);
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
    const volumes: number[] = (result.indicators?.quote?.[0]?.volume || []).filter(
      (v: number | null) => v != null
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

    const atr14 = calculateATR(highs, lows, closes);
    const atr14Percent = atr14 && currentPrice ? Math.round((atr14 / currentPrice) * 10000) / 100 : null;
    const sr = calculateSupportResistance(highs, lows);

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
      atr14,
      atr14Percent,
      macd: calculateMACD(closes),
      bollingerBands: calculateBollinger(closes),
      volume: calculateVolume(volumes),
      support: sr.support,
      resistance: sr.resistance,
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
