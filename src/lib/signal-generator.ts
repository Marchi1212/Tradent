import Anthropic from "@anthropic-ai/sdk";
import { fetchMarketDataForSession, fetchCryptoMarketData, fetchNonXetraMarketData, type AssetMarketData } from "./market-data";
import { getTradingDayType, type TradingDayType } from "./market-hours";
import { fetchMarketContext, formatMarketContextForPrompt } from "./market-context";

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

ANALYSE-HIERARCHIE (Gewichtung):
1. PRIMÄR – Technische Analyse (Kernentscheidung):
   RSI14 + SMA20 + Price Action bestimmen Richtung. Momentum (1T/5T) bestätigt Trend. Support/Resistance (5T-Hoch/Tief) definieren Entry/SL/TP.
2. SEKUNDÄR – Event-Filter (Veto-Funktion):
   Earnings heute/morgen → Aktie NICHT traden oder Konfidenz -20-30%. FOMC/EZB/NFP/CPI heute → betroffene Märkte meiden oder Hebel halbieren.
3. TERTIÄR – Sentiment (Feinjustierung ±5-10%):
   Fear & Greed Extreme (<20 oder >80) verschieben Konfidenz als Kontraindikator.

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
- optimalEntry = konkretes Zeitfenster mit bester Liquidität (z.B. "09:00–10:00" für EU-Indizes, "15:30–16:30" für US)
- marketCloseTime = XTB-Handelsschluss (z.B. "22:00" für EU-Index-CFDs, "23:00" für US-Index-CFDs, "17:30" für EU-Aktien, "22:00" für US-Aktien)
- Begründung auf Deutsch, 2-3 Sätze – erwähne Sentiment/Events wenn relevant
- Entscheide nach Qualität des Setups UND berücksichtige Marktkontext

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_WEEKEND = `Du bist ein erfahrener Krypto-Daytrading-Analyst. Es ist Wochenende – traditionelle Märkte sind geschlossen. Du analysierst die Krypto-Marktdaten tiefgehend und identifizierst die 2 besten Crypto-Trading-Setups.

ANALYSE-HIERARCHIE (Gewichtung):
1. PRIMÄR – Technische Analyse: RSI14, SMA20, Price Action, Momentum
2. SEKUNDÄR – Crypto Fear & Greed als Kontraindikator bei Extremen (±5-10% Konfidenz)
3. Crypto-spezifisch: Volumen-Muster am Wochenende, Volatilitäts-Levels

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

ANALYSE-HIERARCHIE (Gewichtung):
1. PRIMÄR – Technische Analyse: RSI14, SMA20, Price Action, Momentum
2. SEKUNDÄR – Event-Filter: Earnings/FOMC/NFP → Veto oder Konfidenz senken
3. TERTIÄR – Sentiment: Fear & Greed Extreme als Kontraindikator (±5-10%)

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
- optimalEntry = konkretes Zeitfenster mit bester Liquidität
- marketCloseTime = XTB-Handelsschluss für das jeweilige Instrument
- Begründung auf Deutsch, 2-3 Sätze
- Performance first

Antworte ausschließlich mit JSON, kein anderer Text.`;

function getSystemPrompt(dayType: TradingDayType): string {
  if (dayType === "weekend") return SYSTEM_PROMPT_WEEKEND;
  if (dayType === "german_holiday") return SYSTEM_PROMPT_HOLIDAY;
  return SYSTEM_PROMPT_WEEKDAY;
}

function buildUserPrompt(marketData: string, date: string, dayType: TradingDayType, marketContext?: string): string {
  const tradingHours = dayType === "weekend"
    ? `Handelszeiten (deutsche Zeit):
- Krypto: 24/7 – einziger handelbarer Markt am Wochenende`
    : dayType === "german_holiday"
      ? `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Index-CFDs (US500, US100, US30): 00:05–23:00
- US-Aktien-CFDs: 15:30–22:00
- Forex: 24h (Mo–Fr)
- Rohstoffe: ~00:00–23:00
- Krypto: 24/7
- XETRA/EU-Aktien/EU-Indizes: GESCHLOSSEN (Feiertag)
WICHTIG: marketCloseTime = XTB-Handelsschluss`
      : `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Index-CFDs (DE40, EU50, FRA40, UK100, JAP225): 01:15–22:00
- Index-CFDs (US500, US100, US30): 00:05–23:00
- EU-Aktien-CFDs (XETRA): 09:00–17:30
- US-Aktien-CFDs (NYSE/NASDAQ): 15:30–22:00
- Forex: 24h (Mo–Fr), So 23:00 – Fr 22:00
- Rohstoffe (Gold, Silber, Öl etc.): ~00:00–23:00
- Krypto: 24/7
WICHTIG: marketCloseTime = XTB-Handelsschluss (NICHT Börsenschluss)`;

  const instruction = dayType === "weekend"
    ? "Wähle die 2 absolut besten Krypto-Setups. Analysiere jedes Asset tiefgehend."
    : dayType === "german_holiday"
      ? "Wähle die 2 absolut besten Setups aus den VERFÜGBAREN Märkten (kein XETRA)."
      : "Wähle die 2 absolut besten Setups aus ALLEN Assets.";

  const exampleMarket = dayType === "weekend" ? "Krypto" : "XETRA";
  const exampleCategory = dayType === "weekend" ? "Krypto" : "Index";

  const contextBlock = marketContext
    ? `\n${marketContext}\n`
    : "";

  return `Datum: ${date}

${tradingHours}
${contextBlock}
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

  // 1. Marktdaten + Kontext parallel laden
  const [marketData, marketContext] = await Promise.all([
    fetchMarketDataForDayType(dayType),
    fetchMarketContext(),
  ]);

  // Kontext loggen
  if (marketContext.fearGreed) {
    console.log(`Fear & Greed: ${marketContext.fearGreed.value} (${marketContext.fearGreed.classification})`);
  }
  if (marketContext.earnings.length > 0) {
    console.log(`Earnings diese Woche: ${marketContext.earnings.map(e => e.name).join(", ")}`);
  }
  if (marketContext.economicEvents.length > 0) {
    console.log(`High-Impact Events heute: ${marketContext.economicEvents.map(e => e.title).join(", ")}`);
  }

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
  const formattedContext = formatMarketContextForPrompt(marketContext);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: getSystemPrompt(dayType),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(formattedData, today, dayType, formattedContext),
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

  // 5. Perplexity Gegencheck (optional – nur wenn API Key vorhanden)
  if (process.env.PERPLEXITY_API_KEY) {
    console.log("Perplexity Gegencheck wird durchgeführt...");
    const [steadyCheck, boldCheck] = await Promise.all([
      perplexityCheck(parsed.steady),
      perplexityCheck(parsed.bold),
    ]);

    if (steadyCheck) {
      if (!steadyCheck.approved) {
        console.log(`Perplexity WARNUNG (Steady): ${steadyCheck.reason}`);
        parsed.steady.confidence = Math.max(40, parsed.steady.confidence - steadyCheck.confidenceReduction);
        parsed.steady.reasoning += ` ⚠️ ${steadyCheck.reason}`;
      } else {
        console.log(`Perplexity OK (Steady): ${steadyCheck.reason}`);
      }
    }

    if (boldCheck) {
      if (!boldCheck.approved) {
        console.log(`Perplexity WARNUNG (Bold): ${boldCheck.reason}`);
        parsed.bold.confidence = Math.max(40, parsed.bold.confidence - boldCheck.confidenceReduction);
        parsed.bold.reasoning += ` ⚠️ ${boldCheck.reason}`;
      } else {
        console.log(`Perplexity OK (Bold): ${boldCheck.reason}`);
      }
    }
  }

  return parsed;
}

// ── Perplexity News-Gegencheck ──────────────────

interface PerplexityResult {
  approved: boolean;
  confidenceReduction: number;
  reason: string;
}

async function perplexityCheck(signal: GeneratedSignal): Promise<PerplexityResult | null> {
  try {
    const res = await fetch("https://api.perplexity.ai/v1/sonar", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `Du bist ein Finanz-News-Analyst. Prüfe ob es aktuelle Nachrichten gibt die einen geplanten Trade gefährden könnten. Suche nach: Gewinnwarnungen, regulatorische Probleme, geopolitische Risiken, unerwartete Ereignisse.

Antworte NUR mit JSON:
{
  "approved": true/false,
  "confidenceReduction": 0-30,
  "reason": "Kurze Begründung auf Deutsch"
}

approved=true wenn keine negativen News gefunden.
approved=false + confidenceReduction wenn Risiken bestehen (10=leicht, 20=mittel, 30=schwer).`,
          },
          {
            role: "user",
            content: `Prüfe diesen Trade auf aktuelle Risiken:
- Asset: ${signal.asset} (${signal.ticker})
- Richtung: ${signal.direction}
- Kategorie: ${signal.category}
- Markt: ${signal.market}

Gibt es heute aktuelle Nachrichten die diesen ${signal.direction}-Trade auf ${signal.asset} gefährden könnten?`,
          },
        ],
        max_tokens: 300,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`Perplexity API Fehler: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as PerplexityResult;
  } catch (err) {
    console.error("Perplexity Check fehlgeschlagen:", err);
    return null; // Bei Fehler einfach weitermachen ohne Check
  }
}
