import Anthropic from "@anthropic-ai/sdk";
import { fetchAllMarketData, type AssetMarketData } from "./market-data";

export interface GeneratedSignal {
  asset: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  riskClass: "steady" | "bold";
  leverage: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  expectedGainPercent: number;
  riskRewardRatio: string;
  reasoning: string;
  market: string;
  marketCloseTime: string;
  optimalEntry: string;
  category: string;
}

function formatMarketDataForPrompt(data: AssetMarketData[]): string {
  return data
    .map(
      (d) =>
        `${d.name} (${d.ticker}) | ${d.category} | ${d.market}
  Kurs: ${d.currentPrice} | 1T: ${d.change1dPercent > 0 ? "+" : ""}${d.change1dPercent}% | 5T: ${d.change5dPercent > 0 ? "+" : ""}${d.change5dPercent}%
  5T-Hoch: ${d.high5d} | 5T-Tief: ${d.low5d} | SMA20: ${d.sma20 ?? "n/a"} | RSI14: ${d.rsi14 ?? "n/a"}`
    )
    .join("\n\n");
}

const SYSTEM_PROMPT = `Du bist ein erfahrener CFD-Daytrading-Analyst. Du analysierst Marktdaten und identifizierst die 2 besten Trading-Setups des Tages.

Deine Analyse basiert auf:
- Technische Analyse (Trend, Momentum, Support/Resistance, RSI, SMA)
- Preis-Action und Volatilität
- Risk/Reward-Optimierung

Du gibst immer 2 Signale aus:
1. STEADY: Hohe Konfidenz (≥75%), moderater Hebel (2x–5x), konservatives Setup
2. BOLD: Kann risikoreicher sein (Konfidenz ≥55%), höherer Hebel (5x–10x), aggressiveres Setup mit mehr Potenzial

Regeln:
- Alle Trades sind CFD-Daytrading auf XTB
- Risk-Reward-Ratio mindestens 1:1.5
- Entry, Stop-Loss und Take-Profit müssen präzise, realistische Kursniveaus sein
- Stop-Loss muss eng genug sein für Daytrading
- Beide Assets MÜSSEN unterschiedlich sein
- LONG und SHORT sind beide möglich
- expectedGainPercent = prozentualer Gewinn bei Take-Profit MIT Hebel
- Begründung auf Deutsch, 2-3 Sätze

Antworte ausschließlich mit JSON, kein anderer Text.`;

function buildUserPrompt(marketData: string, date: string): string {
  return `Datum: ${date}

Marktdaten:

${marketData}

Analysiere alle Assets und wähle die 2 besten Setups. Antworte NUR mit diesem JSON:

{
  "steady": {
    "asset": "Name",
    "ticker": "XTB-Ticker",
    "direction": "LONG",
    "leverage": "3x",
    "entry": 18450.00,
    "stopLoss": 18380.00,
    "takeProfit": 18590.00,
    "confidence": 82,
    "expectedGainPercent": 6.0,
    "riskRewardRatio": "1:2",
    "reasoning": "Begründung auf Deutsch...",
    "market": "XETRA",
    "marketCloseTime": "17:30",
    "optimalEntry": "09:00–11:00",
    "category": "Index"
  },
  "bold": {
    "asset": "Name",
    "ticker": "XTB-Ticker",
    "direction": "SHORT",
    "leverage": "7x",
    "entry": 178.50,
    "stopLoss": 182.00,
    "takeProfit": 169.50,
    "confidence": 62,
    "expectedGainPercent": 35.0,
    "riskRewardRatio": "1:2.5",
    "reasoning": "Begründung auf Deutsch...",
    "market": "NYSE",
    "marketCloseTime": "22:00",
    "optimalEntry": "15:30–17:00",
    "category": "Aktie"
  }
}`;
}

export async function generateSignals(): Promise<{
  steady: GeneratedSignal;
  bold: GeneratedSignal;
}> {
  // 1. Marktdaten laden
  console.log("Lade Marktdaten...");
  const marketData = await fetchAllMarketData();

  if (marketData.length < 3) {
    throw new Error(
      `Zu wenig Marktdaten geladen (${marketData.length} Assets). Mindestens 3 benötigt.`
    );
  }

  console.log(`${marketData.length} Assets geladen. Rufe Claude API auf...`);

  // 2. Claude API aufrufen
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedData = formatMarketDataForPrompt(marketData);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(formattedData, today),
      },
    ],
  });

  // 3. Antwort parsen
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Text-Antwort von Claude erhalten");
  }

  let parsed: { steady: GeneratedSignal; bold: GeneratedSignal };
  try {
    // JSON aus der Antwort extrahieren (falls drumherum Text ist)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Kein JSON in der Antwort gefunden");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Claude Antwort:", textBlock.text);
    throw new Error(`JSON-Parsing fehlgeschlagen: ${err}`);
  }

  // 4. Validieren
  if (!parsed.steady || !parsed.bold) {
    throw new Error("Antwort enthält nicht beide Signale (steady + bold)");
  }

  // Risk-Class setzen
  parsed.steady.riskClass = "steady";
  parsed.bold.riskClass = "bold";

  console.log(
    `Signale generiert: ${parsed.steady.asset} (Steady) + ${parsed.bold.asset} (Bold)`
  );

  return parsed;
}
