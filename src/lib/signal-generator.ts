import Anthropic from "@anthropic-ai/sdk";
import { fetchMarketDataForSession, fetchCryptoMarketData, fetchNonXetraMarketData, fetchGlobalMarketData, fetchNonUSMarketData, type AssetMarketData } from "./market-data";
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
- optimalEntry = konkretes 2-Stunden-Zeitfenster mit bester Liquidität (z.B. "09:00–11:00" für EU-Indizes, "15:30–17:30" für US). MAXIMAL 2 Stunden breit!
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
- optimalEntry = konkretes 2-Stunden-Zeitfenster (z.B. "09:00–11:00", "14:00–16:00"). MAXIMAL 2 Stunden breit, nicht breiter!
- marketCloseTime = "21:00" (Krypto 24/7, aber Trade soll abends geschlossen werden)
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
- optimalEntry = konkretes 2-Stunden-Zeitfenster mit bester Liquidität (z.B. "15:30–17:30"). MAXIMAL 2 Stunden breit!
- marketCloseTime = XTB-Handelsschluss für das jeweilige Instrument
- Begründung auf Deutsch, 2-3 Sätze
- Performance first

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_DOUBLE_HOLIDAY = `Du bist ein erfahrener CFD-Daytrading-Analyst. Heute ist sowohl ein deutscher als auch ein US-Feiertag – XETRA, europäische UND US-Börsen sind geschlossen. Handelbar sind nur Forex, Rohstoffe und Krypto. Du analysierst die verfügbaren Marktdaten und identifizierst die 2 besten Trading-Setups.

ANALYSE-HIERARCHIE (Gewichtung):
1. PRIMÄR – Technische Analyse: RSI14, SMA20, Price Action, Momentum
2. SEKUNDÄR – Feiertags-Kontext: Liquidität ist reduziert, Spreads können breiter sein. Konservativere Hebel bevorzugen.
3. TERTIÄR – Sentiment: Fear & Greed Extreme als Kontraindikator (±5-10%)

Du gibst genau 2 Signale aus:
1. STEADY: Hohe Konfidenz (≥75%), moderater Hebel (2x–5x), konservatives Setup
2. BOLD: Kann risikoreicher sein (Konfidenz ≥55%), höherer Hebel (5x–10x), aggressiveres Setup mit mehr Potenzial

Regeln:
- Alle Trades sind CFD-Daytrading auf XTB
- Jeder Trade wird INNERHALB eines Tages eröffnet und VOR Handelsschluss geschlossen
- Risk-Reward-Ratio mindestens 1:1.5
- Entry, Stop-Loss und Take-Profit müssen präzise, realistische Kursniveaus sein
- Wähle die 2 BESTEN Assets aus Forex, Rohstoffe ODER Krypto
- Beide Assets MÜSSEN unterschiedlich sein
- LONG und SHORT sind beide möglich
- expectedGainPercent = prozentualer Gewinn bei Take-Profit MIT Hebel
- optimalEntry = konkretes 2-Stunden-Zeitfenster. MAXIMAL 2 Stunden breit!
- marketCloseTime = XTB-Handelsschluss für das jeweilige Instrument
- Begründung auf Deutsch, 2-3 Sätze
- Performance first

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_US_HOLIDAY = `Du bist ein erfahrener CFD-Daytrading-Analyst. Heute ist ein US-Feiertag – NYSE und NASDAQ sind geschlossen. Europäische Börsen, Forex, Rohstoffe und Krypto sind handelbar. Du analysierst die verfügbaren Marktdaten und identifizierst die 2 besten Trading-Setups.

ANALYSE-HIERARCHIE (Gewichtung):
1. PRIMÄR – Technische Analyse: RSI14, SMA20, Price Action, Momentum
2. SEKUNDÄR – Event-Filter: Earnings/EZB → Veto oder Konfidenz senken
3. TERTIÄR – Sentiment: Fear & Greed Extreme als Kontraindikator (±5-10%)

Du gibst genau 2 Signale aus:
1. STEADY: Hohe Konfidenz (≥75%), moderater Hebel (2x–5x), konservatives Setup
2. BOLD: Kann risikoreicher sein (Konfidenz ≥55%), höherer Hebel (5x–10x), aggressiveres Setup mit mehr Potenzial

Regeln:
- Alle Trades sind CFD-Daytrading auf XTB
- Jeder Trade wird INNERHALB eines Tages eröffnet und VOR Handelsschluss geschlossen
- Risk-Reward-Ratio mindestens 1:1.5
- Entry, Stop-Loss und Take-Profit müssen präzise, realistische Kursniveaus sein
- Wähle die 2 BESTEN Assets aus den VERFÜGBAREN Märkten (kein US)
- Beide Assets MÜSSEN unterschiedlich sein
- LONG und SHORT sind beide möglich
- expectedGainPercent = prozentualer Gewinn bei Take-Profit MIT Hebel
- optimalEntry = konkretes 2-Stunden-Zeitfenster mit bester Liquidität. MAXIMAL 2 Stunden breit!
- marketCloseTime = XTB-Handelsschluss für das jeweilige Instrument
- Begründung auf Deutsch, 2-3 Sätze
- Performance first

Antworte ausschließlich mit JSON, kein anderer Text.`;

function getSystemPrompt(dayType: TradingDayType): string {
  if (dayType === "weekend") return SYSTEM_PROMPT_WEEKEND;
  if (dayType === "double_holiday") return SYSTEM_PROMPT_DOUBLE_HOLIDAY;
  if (dayType === "german_holiday") return SYSTEM_PROMPT_HOLIDAY;
  if (dayType === "us_holiday") return SYSTEM_PROMPT_US_HOLIDAY;
  return SYSTEM_PROMPT_WEEKDAY;
}

function buildUserPrompt(marketData: string, date: string, dayType: TradingDayType, marketContext?: string): string {
  const tradingHoursMap: Record<TradingDayType, string> = {
    weekend: `Handelszeiten (deutsche Zeit):
- Krypto: 24/7 – einziger handelbarer Markt am Wochenende`,
    double_holiday: `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Forex: 24h (Mo–Fr)
- Rohstoffe: ~00:00–23:00
- Krypto: 24/7
- XETRA/EU-Aktien/EU-Indizes: GESCHLOSSEN (Feiertag)
- US-Indizes/US-Aktien: GESCHLOSSEN (US-Feiertag)
WICHTIG: marketCloseTime = XTB-Handelsschluss`,
    german_holiday: `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Index-CFDs (US500, US100, US30): 00:05–23:00
- US-Aktien-CFDs: 15:30–22:00
- Forex: 24h (Mo–Fr)
- Rohstoffe: ~00:00–23:00
- Krypto: 24/7
- XETRA/EU-Aktien/EU-Indizes: GESCHLOSSEN (Feiertag)
WICHTIG: marketCloseTime = XTB-Handelsschluss`,
    us_holiday: `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Index-CFDs (DE40, EU50, FRA40, UK100, JAP225): 01:15–22:00
- EU-Aktien-CFDs (XETRA): 09:00–17:30
- Forex: 24h (Mo–Fr)
- Rohstoffe: ~00:00–23:00
- Krypto: 24/7
- US-Indizes/US-Aktien: GESCHLOSSEN (US-Feiertag)
WICHTIG: marketCloseTime = XTB-Handelsschluss`,
    weekday: `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Index-CFDs (DE40, EU50, FRA40, UK100, JAP225): 01:15–22:00
- Index-CFDs (US500, US100, US30): 00:05–23:00
- EU-Aktien-CFDs (XETRA): 09:00–17:30
- US-Aktien-CFDs (NYSE/NASDAQ): 15:30–22:00
- Forex: 24h (Mo–Fr), So 23:00 – Fr 22:00
- Rohstoffe (Gold, Silber, Öl etc.): ~00:00–23:00
- Krypto: 24/7
WICHTIG: marketCloseTime = XTB-Handelsschluss (NICHT Börsenschluss)`,
  };
  const tradingHours = tradingHoursMap[dayType];

  const instructionMap: Record<TradingDayType, string> = {
    weekend: "Wähle die 2 absolut besten Krypto-Setups. Analysiere jedes Asset tiefgehend.",
    double_holiday: "Wähle die 2 absolut besten Setups aus Forex, Rohstoffen und Krypto.",
    german_holiday: "Wähle die 2 absolut besten Setups aus den VERFÜGBAREN Märkten (kein XETRA).",
    us_holiday: "Wähle die 2 absolut besten Setups aus den VERFÜGBAREN Märkten (kein US).",
    weekday: "Wähle die 2 absolut besten Setups aus ALLEN Assets.",
  };
  const instruction = instructionMap[dayType];

  const exampleMarket = dayType === "weekend" || dayType === "double_holiday" ? "Krypto" : "XETRA";
  const exampleCategory = dayType === "weekend" || dayType === "double_holiday" ? "Krypto" : "Index";

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
    "marketCloseTime": "21:00",
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

  if (dayType === "double_holiday") {
    return fetchGlobalMarketData();
  }

  if (dayType === "german_holiday") {
    return fetchNonXetraMarketData();
  }

  if (dayType === "us_holiday") {
    return fetchNonUSMarketData();
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
  const modeLabels: Record<TradingDayType, string> = {
    weekend: "Wochenende (nur Krypto)",
    double_holiday: "Doppel-Feiertag (nur Forex/Rohstoffe/Krypto)",
    german_holiday: "DE-Feiertag (ohne XETRA)",
    us_holiday: "US-Feiertag (ohne US)",
    weekday: "Wochentag (alle Assets)",
  };
  const modeLabel = modeLabels[dayType];

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
            content: `Du bist ein Finanz-News-Filter. Deine EINZIGE Aufgabe: Prüfe ob es in den letzten 24 Stunden eine KONKRETE, UNERWARTETE Nachricht gibt, die diesen spezifischen Trade direkt gefährdet.

WARNUNG NUR bei konkreten, heutigen Events wie:
- Überraschende Gewinnwarnung oder Bilanzskandal (bei Aktien)
- Plötzliche Regulierungsmaßnahme die dieses Asset direkt betrifft
- Unerwarteter Flash-Crash oder Handelsaussetzung
- Überraschende Zentralbank-Notfallsitzung
- Unternehmensspezifischer Skandal (Betrug, CEO-Rücktritt, etc.)

KEIN Grund für eine Warnung (MUSS approved=true sein):
- Allgemeine Marktvolatilität oder -unsicherheit
- Laufende geopolitische Spannungen (Kriege, Handelskonflikte)
- Bekannte Inflationsdaten oder Zinserwartungen
- Allgemeines Sentiment (Fear & Greed, Risk-off-Stimmung)
- Technische Schwäche oder Momentum-Verlust (ist bereits in der Analyse)
- Liquidationsrisiken bei Krypto (sind normal)
- Generelle Aussagen wie "Markt ist unsicher"

Im Zweifel: approved=true. Der technische Analyst hat diese Faktoren bereits berücksichtigt. Du suchst NUR nach Überraschungen die noch NICHT im Kurs eingepreist sind.

Antworte NUR mit JSON:
{
  "approved": true/false,
  "confidenceReduction": 0-30,
  "reason": "Kurze Begründung auf Deutsch (max 1 Satz)"
}`,
          },
          {
            role: "user",
            content: `Gibt es in den letzten 24h eine KONKRETE, ÜBERRASCHENDE Nachricht die diesen Trade direkt gefährdet?

Asset: ${signal.asset} (${signal.ticker})
Richtung: ${signal.direction}
Kategorie: ${signal.category}

Antworte mit approved=true wenn du KEINE konkrete Überraschungsnachricht findest. Allgemeine Marktlage ist KEIN Grund für eine Warnung.`,
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
