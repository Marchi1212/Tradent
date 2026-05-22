import Anthropic from "@anthropic-ai/sdk";
import { fetchMarketDataForSession, fetchCryptoMarketData, fetchNonXetraMarketData, type AssetMarketData } from "./market-data";
import { getTradingDayType, type TradingDayType } from "./market-hours";

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

const SYSTEM_PROMPT_WEEKDAY = `Du bist ein erfahrener CFD-Daytrading-Analyst. Du analysierst Marktdaten aus allen Assetklassen und identifizierst die 2 absolut besten Trading-Setups des Tages – unabhängig vom Markt.

Deine Analyse basiert auf:
- Technische Analyse (Trend, Momentum, Support/Resistance, RSI, SMA)
- Preis-Action und Volatilität
- Risk/Reward-Optimierung

Du gibst genau 2 Signale aus:
1. STEADY: Hohe Konfidenz (≥75%), moderater Hebel (2x–5x), konservatives Setup
2. BOLD: Kann risikoreicher sein (Konfidenz ≥55%), höherer Hebel (5x–10x), aggressiveres Setup mit mehr Potenzial

Regeln:
- Alle Trades sind CFD-Daytrading auf XTB
- Jeder Trade wird INNERHALB eines Tages eröffnet und VOR Handelsschluss geschlossen
- Risk-Reward-Ratio mindestens 1:1.5
- Entry, Stop-Loss und Take-Profit müssen präzise, realistische Kursniveaus sein
- Stop-Loss muss eng genug sein für Daytrading (Intraday-Levels)
- Wähle die 2 BESTEN Assets – egal ob Index, Aktie, Forex, Rohstoff oder Krypto
- Beide Assets MÜSSEN unterschiedlich sein
- LONG und SHORT sind beide möglich
- expectedGainPercent = prozentualer Gewinn bei Take-Profit MIT Hebel
- optimalEntry = konkretes Zeitfenster (z.B. "09:00–10:00" für EU, "15:30–16:30" für US)
- marketCloseTime = wann der Markt schließt und der Trade spätestens geschlossen werden muss
- Begründung auf Deutsch, 2-3 Sätze
- Entscheide rein nach Qualität des Setups – Performance first

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_WEEKEND = `Du bist ein erfahrener Krypto-Daytrading-Analyst. Es ist Wochenende – traditionelle Märkte sind geschlossen. Du analysierst die Krypto-Marktdaten tiefgehend und identifizierst die 2 besten Crypto-Trading-Setups.

Deine Analyse basiert auf:
- Technische Analyse (Trend, Momentum, Support/Resistance, RSI, SMA)
- Crypto-spezifische Faktoren (Volumen-Muster am Wochenende, Whale-Bewegungen, On-Chain-Signale)
- Preis-Action und Volatilität
- Risk/Reward-Optimierung

Du gibst genau 2 Signale aus:
1. STEADY: Hohe Konfidenz (≥75%), moderater Hebel (2x–5x), konservatives Setup
2. BOLD: Kann risikoreicher sein (Konfidenz ≥55%), höherer Hebel (5x–10x), aggressiveres Setup mit mehr Potenzial

Regeln:
- Alle Trades sind Krypto-CFDs auf XTB
- Daytrading: Positionen werden innerhalb des Tages geöffnet und geschlossen
- Risk-Reward-Ratio mindestens 1:1.5
- Entry, Stop-Loss und Take-Profit müssen präzise, realistische Kursniveaus sein
- Beide Assets MÜSSEN unterschiedlich sein
- LONG und SHORT sind beide möglich
- Krypto-Volatilität am Wochenende beachten (oft niedriger, aber mit plötzlichen Spikes)
- expectedGainPercent = prozentualer Gewinn bei Take-Profit MIT Hebel
- optimalEntry = konkretes Zeitfenster (z.B. "10:00–12:00", "14:00–16:00")
- marketCloseTime = "23:59" (Krypto 24/7, aber Trade soll am selben Tag geschlossen werden)
- Begründung auf Deutsch, 2-3 Sätze
- Performance first – analysiere jedes Asset sorgfältig

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_HOLIDAY = `Du bist ein erfahrener CFD-Daytrading-Analyst. Heute ist ein deutscher Feiertag – XETRA und europäische Börsen sind geschlossen. US-Märkte, Forex, Rohstoffe und Krypto sind aber handelbar. Du analysierst die verfügbaren Marktdaten und identifizierst die 2 besten Trading-Setups.

Deine Analyse basiert auf:
- Technische Analyse (Trend, Momentum, Support/Resistance, RSI, SMA)
- Preis-Action und Volatilität
- Risk/Reward-Optimierung

Du gibst genau 2 Signale aus:
1. STEADY: Hohe Konfidenz (≥75%), moderater Hebel (2x–5x), konservatives Setup
2. BOLD: Kann risikoreicher sein (Konfidenz ≥55%), höherer Hebel (5x–10x), aggressiveres Setup mit mehr Potenzial

Regeln:
- Alle Trades sind CFD-Daytrading auf XTB
- Jeder Trade wird INNERHALB eines Tages eröffnet und VOR Handelsschluss geschlossen
- Risk-Reward-Ratio mindestens 1:1.5
- Entry, Stop-Loss und Take-Profit müssen präzise, realistische Kursniveaus sein
- Wähle die 2 BESTEN Assets aus den VERFÜGBAREN Märkten (US, Forex, Rohstoffe, Krypto)
- Beide Assets MÜSSEN unterschiedlich sein
- LONG und SHORT sind beide möglich
- expectedGainPercent = prozentualer Gewinn bei Take-Profit MIT Hebel
- optimalEntry = konkretes Zeitfenster
- marketCloseTime = wann der Trade spätestens geschlossen werden muss
- Begründung auf Deutsch, 2-3 Sätze
- Performance first

Antworte ausschließlich mit JSON, kein anderer Text.`;

function getSystemPrompt(dayType: TradingDayType): string {
  if (dayType === "weekend") return SYSTEM_PROMPT_WEEKEND;
  if (dayType === "german_holiday") return SYSTEM_PROMPT_HOLIDAY;
  return SYSTEM_PROMPT_WEEKDAY;
}

function buildUserPrompt(marketData: string, date: string, dayType: TradingDayType): string {
  const tradingHours = dayType === "weekend"
    ? `Handelszeiten (deutsche Zeit):
- Krypto: 24/7 – einziger handelbarer Markt am Wochenende`
    : dayType === "german_holiday"
      ? `Handelszeiten (deutsche Zeit):
- NYSE/US-Aktien: 15:30–22:00
- Forex: 24h (Mo–Fr)
- Rohstoffe (COMEX/NYMEX): 08:20–20:30
- Krypto: 24/7
- XETRA/EU-Aktien: GESCHLOSSEN (Feiertag)`
      : `Handelszeiten (deutsche Zeit):
- XETRA/EU-Aktien: 09:00–17:30
- NYSE/US-Aktien: 15:30–22:00
- Forex: 24h (Mo–Fr)
- Rohstoffe (COMEX/NYMEX): 08:20–20:30
- Krypto: 24/7`;

  const instruction = dayType === "weekend"
    ? "Wähle die 2 absolut besten Krypto-Setups. Analysiere jedes Asset tiefgehend."
    : dayType === "german_holiday"
      ? "Wähle die 2 absolut besten Setups aus den VERFÜGBAREN Märkten (kein XETRA)."
      : "Wähle die 2 absolut besten Setups aus ALLEN Assets.";

  const exampleMarket = dayType === "weekend" ? "Krypto" : "XETRA";
  const exampleCategory = dayType === "weekend" ? "Krypto" : "Index";

  return `Datum: ${date}

${tradingHours}

Marktdaten:

${marketData}

${instruction} Antworte NUR mit diesem JSON:

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
    "market": "${exampleMarket}",
    "marketCloseTime": "17:30",
    "optimalEntry": "09:00–10:00",
    "category": "${exampleCategory}"
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
    "market": "Krypto",
    "marketCloseTime": "23:59",
    "optimalEntry": "15:30–16:30",
    "category": "Krypto"
  }
}`;
}

// Marktdaten je nach Tagestyp laden
async function fetchMarketDataForDayType(dayType: TradingDayType): Promise<AssetMarketData[]> {
  if (dayType === "weekend") {
    return fetchCryptoMarketData();
  }

  if (dayType === "german_holiday") {
    return fetchNonXetraMarketData();
  }

  // Normaler Wochentag: alle Assets
  const [euData, usData] = await Promise.all([
    fetchMarketDataForSession("eu"),
    fetchMarketDataForSession("us"),
  ]);

  const seen = new Set<string>();
  const combined: AssetMarketData[] = [];
  for (const d of [...euData, ...usData]) {
    if (!seen.has(d.ticker)) {
      seen.add(d.ticker);
      combined.push(d);
    }
  }
  return combined;
}

export async function generateSignals(): Promise<{
  steady: GeneratedSignal;
  bold: GeneratedSignal;
}> {
  const dayType = getTradingDayType();
  const modeLabel = dayType === "weekend" ? "Wochenende (nur Krypto)"
    : dayType === "german_holiday" ? "Feiertag (ohne XETRA)"
    : "Wochentag (alle Assets)";

  console.log(`Modus: ${modeLabel}`);

  // 1. Marktdaten laden
  const marketData = await fetchMarketDataForDayType(dayType);

  const minAssets = dayType === "weekend" ? 3 : 5;
  if (marketData.length < minAssets) {
    throw new Error(
      `Zu wenig Marktdaten geladen (${marketData.length} Assets). Mindestens ${minAssets} benötigt.`
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
    system: getSystemPrompt(dayType),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(formattedData, today, dayType),
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

  parsed.steady.riskClass = "steady";
  parsed.bold.riskClass = "bold";

  console.log(
    `Signale generiert: ${parsed.steady.asset} (Steady, ${parsed.steady.market}) + ${parsed.bold.asset} (Bold, ${parsed.bold.market})`
  );

  return parsed;
}
