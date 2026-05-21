export type RiskClass = "steady" | "bold";
export type Direction = "LONG" | "SHORT";
export type MarketStatus = "open" | "closed" | "opening-soon";

export interface Signal {
  id: string;
  asset: string;
  ticker: string;
  direction: Direction;
  riskClass: RiskClass;
  leverage: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number; // 0-100
  expectedGainPercent: number;
  riskRewardRatio: string;
  reasoning: string;
  market: string;
  marketStatus: MarketStatus;
  marketCloseTime: string;
  optimalEntry: string;
  category: string;
}

export const mockSignals: Signal[] = [
  {
    id: "1",
    asset: "DAX 40",
    ticker: "DE40",
    direction: "LONG",
    riskClass: "steady",
    leverage: "3x",
    entry: 18450,
    stopLoss: 18265,
    takeProfit: 18820,
    confidence: 87,
    expectedGainPercent: 6.0,
    riskRewardRatio: "1:2",
    reasoning:
      "Bullishes Momentum über dem 50-Tage-EMA. RSI bei 58 mit klarem Aufwärtstrend. Europäische Wirtschaftsdaten positiv, geopolitische Lage stabil. Volumen bestätigt den Trend.",
    market: "XETRA",
    marketStatus: "open",
    marketCloseTime: "17:30",
    optimalEntry: "09:00–11:00",
    category: "Index",
  },
  {
    id: "2",
    asset: "Tesla",
    ticker: "TSLA.US",
    direction: "LONG",
    riskClass: "bold",
    leverage: "5x",
    entry: 178.5,
    stopLoss: 172.3,
    takeProfit: 191.0,
    confidence: 68,
    expectedGainPercent: 35.0,
    riskRewardRatio: "1:2",
    reasoning:
      "Breakout über Widerstand bei $177. Earnings nächste Woche erwartet positiv. Hohes Short-Interest könnte Short-Squeeze auslösen. Riskanter Trade, aber hohes Potenzial.",
    market: "NYSE",
    marketStatus: "opening-soon",
    marketCloseTime: "22:00",
    optimalEntry: "15:30–17:00",
    category: "Aktie",
  },
  {
    id: "3",
    asset: "Bitcoin",
    ticker: "BTC",
    direction: "SHORT",
    riskClass: "bold",
    leverage: "4x",
    entry: 68500,
    stopLoss: 70200,
    takeProfit: 64800,
    confidence: 63,
    expectedGainPercent: 21.6,
    riskRewardRatio: "1:2.2",
    reasoning:
      "Doppel-Top bei $69.000 gebildet. RSI überkauft bei 74. On-Chain-Daten zeigen erhöhte Wallet-Transfers zu Börsen. Kurzfristige Korrektur wahrscheinlich.",
    market: "Krypto",
    marketStatus: "open",
    marketCloseTime: "24/7",
    optimalEntry: "Jederzeit",
    category: "Krypto",
  },
  {
    id: "4",
    asset: "S&P 500",
    ticker: "US500",
    direction: "LONG",
    riskClass: "steady",
    leverage: "2x",
    entry: 5320,
    stopLoss: 5275,
    takeProfit: 5410,
    confidence: 82,
    expectedGainPercent: 3.4,
    riskRewardRatio: "1:2",
    reasoning:
      "Index hält sich stabil über der 20-Tage-Linie. Fed-Zinsentscheid letzte Woche positiv aufgenommen. Saisonalität spricht für weiteren Anstieg.",
    market: "NYSE",
    marketStatus: "opening-soon",
    marketCloseTime: "22:00",
    optimalEntry: "15:30–17:00",
    category: "Index",
  },
];
