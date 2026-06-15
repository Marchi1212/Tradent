import Anthropic from "@anthropic-ai/sdk";
import { fetchMarketDataForSession, fetchCryptoMarketData, fetchNonXetraMarketData, fetchGlobalMarketData, fetchNonUSMarketData, fetchForexAndCryptoData, type AssetMarketData } from "./market-data";
import { getTradingDayType, isCMEClosed, getExchangeNotes, type TradingDayType } from "./market-hours";
import { fetchMarketContext, formatMarketContextForPrompt, fetchNewsContext } from "./market-context";

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
  5T-Hoch: ${d.high5d} | 5T-Tief: ${d.low5d} | SMA20: ${d.sma20 ?? "n/a"} | RSI14: ${d.rsi14 ?? "n/a"}
  ATR14: ${d.atr14 ?? "n/a"} (${d.atr14Percent != null ? d.atr14Percent + "%" : "n/a"} vom Kurs)`
    )
    .join("\n\n");
}

const SYSTEM_PROMPT_WEEKDAY = `Du bist ein regelbasierter CFD-Daytrading-Analyst. Du führst den folgenden Entscheidungsbaum STRIKT aus — keine freie Interpretation.

═══ ENTSCHEIDUNGSBAUM ═══

SCHRITT 1 — FILTER (Assets eliminieren):
Eliminiere jedes Asset das EINE dieser Bedingungen erfüllt:
- RSI14 zwischen 45-55 (kein klares Signal, Seitwärtsmarkt)
- ATR14% < 0.3% (zu wenig Tagesbewegung für Daytrading)
- Earnings HEUTE oder MORGEN (zu unberechenbar)
- NEWS-VETO aktiv (siehe News-Block)
→ Nur Assets die ALLE Filter bestehen kommen in Frage.

SCHRITT 2 — RICHTUNG bestimmen:
Für jedes verbleibende Asset:
- RSI14 < 35 UND Kurs < SMA20 → LONG (überverkauft, Mean-Reversion)
- RSI14 > 65 UND Kurs > SMA20 → SHORT (überkauft, Mean-Reversion)
- RSI14 35-45 UND Kurs > SMA20 UND 1T > 0 → LONG (Trend-Fortsetzung)
- RSI14 55-65 UND Kurs < SMA20 UND 1T < 0 → SHORT (Trend-Fortsetzung)
- Wenn keine Regel passt → Asset überspringen

SCHRITT 3 — SL/TP via ATR (PFLICHT):
- Stop-Loss = 1x ATR14 vom Entry entfernt (LONG: Entry - ATR14, SHORT: Entry + ATR14)
- Take-Profit = 1.5x ATR14 vom Entry entfernt (LONG: Entry + 1.5×ATR14, SHORT: Entry - 1.5×ATR14)
- Risk-Reward-Ratio ergibt sich automatisch: 1:1.5
- Wenn ATR14 nicht verfügbar → Asset überspringen

SCHRITT 4 — KONFIDENZ berechnen:
Starte bei 60% Basis, dann addiere/subtrahiere:
+10% wenn RSI14 < 30 oder > 70 (starkes Signal)
+10% wenn Kurs-Trend (1T UND 5T) die Richtung bestätigt
+5%  wenn Kurs nahe 5T-Hoch (SHORT) oder 5T-Tief (LONG) = Support/Resistance
-10% wenn Kurs gegen SMA20-Trend geht
-20% wenn High-Impact Wirtschaftsevent heute
-10% wenn Fear & Greed > 80 (bei LONG) oder < 20 (bei SHORT)
+5%  wenn Fear & Greed < 20 (bei LONG) oder > 80 (bei SHORT) = Kontraindikator
→ Ergebnis auf 40-95% begrenzen.

SCHRITT 5 — AUSWAHL:
- Sortiere nach Konfidenz
- STEADY = höchste Konfidenz, Hebel 2x-5x (Konfidenz muss ≥70%)
- BOLD = zweithöchste Konfidenz, Hebel 5x-10x (Konfidenz muss ≥50%)
- Beide Assets MÜSSEN unterschiedlich sein
- LONG und SHORT sind BEIDE erwünscht — kein Bias!

═══ REGELN ═══
- Alle Trades sind CFD-Daytrading auf XTB
- Jeder Trade wird INNERHALB eines Tages eröffnet und VOR Handelsschluss geschlossen
- expectedGainPercent = prozentualer Gewinn bei Take-Profit MIT Hebel
- optimalEntry = konkretes 2-Stunden-Zeitfenster mit bester Liquidität. MAXIMAL 2 Stunden breit! Bevorzuge 14:00-17:00 CET (London-NY-Overlap = höchste Liquidität).
- marketCloseTime = XTB-Handelsschluss (z.B. "22:00" für EU-Index-CFDs, "23:00" für US-Index-CFDs, "17:30" für EU-Aktien, "22:00" für US-Aktien)
- Begründung auf Deutsch, 2-3 Sätze — nenne welche Regeln den Trade ausgelöst haben

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_WEEKEND = `Du bist ein regelbasierter Krypto-Daytrading-Analyst. Es ist Wochenende — nur Krypto handelbar. Führe den Entscheidungsbaum STRIKT aus.

═══ ENTSCHEIDUNGSBAUM ═══

SCHRITT 1 — FILTER:
- RSI14 zwischen 45-55 → eliminieren
- ATR14% < 0.3% → eliminieren
- NEWS-VETO aktiv → eliminieren

SCHRITT 2 — RICHTUNG:
- RSI14 < 35 UND Kurs < SMA20 → LONG
- RSI14 > 65 UND Kurs > SMA20 → SHORT
- RSI14 35-45 UND Kurs > SMA20 UND 1T > 0 → LONG (Trend)
- RSI14 55-65 UND Kurs < SMA20 UND 1T < 0 → SHORT (Trend)

SCHRITT 3 — SL/TP via ATR:
- SL = 1x ATR14 vom Entry | TP = 1.5x ATR14 vom Entry
- Kein ATR → Asset überspringen

SCHRITT 4 — KONFIDENZ (Basis 60%):
+10% RSI-Extrem (<30/>70) | +10% Trend bestätigt (1T+5T)
+5% Support/Resistance | -10% gegen SMA20
-10% F&G Kontraindikator gegen Richtung | +5% F&G für Richtung
→ Begrenzen auf 40-95%.

SCHRITT 5 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-5x Hebel (≥70%)
- BOLD = zweithöchste, 5x-10x Hebel (≥50%)
- Krypto-Wochenend-Volatilität beachten (oft niedriger, plötzliche Spikes)

═══ REGELN ═══
- Alle Trades sind Krypto-CFDs auf XTB, Daytrading
- expectedGainPercent = Gewinn bei TP MIT Hebel
- optimalEntry = 2h-Zeitfenster, MAXIMAL 2 Stunden breit
- marketCloseTime = "21:00" (Trade abends schließen)
- Begründung auf Deutsch, 2-3 Sätze — nenne welche Regeln den Trade ausgelöst haben

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_HOLIDAY = `Du bist ein regelbasierter CFD-Daytrading-Analyst. Heute ist XETRA-Feiertag — EU-Börsen geschlossen. US, Forex, Rohstoffe, Krypto handelbar. Führe den Entscheidungsbaum STRIKT aus.

═══ ENTSCHEIDUNGSBAUM ═══

SCHRITT 1 — FILTER:
- RSI14 zwischen 45-55 → eliminieren
- ATR14% < 0.3% → eliminieren
- Earnings HEUTE/MORGEN → eliminieren
- NEWS-VETO aktiv → eliminieren

SCHRITT 2 — RICHTUNG:
- RSI14 < 35 UND Kurs < SMA20 → LONG
- RSI14 > 65 UND Kurs > SMA20 → SHORT
- RSI14 35-45 UND Kurs > SMA20 UND 1T > 0 → LONG (Trend)
- RSI14 55-65 UND Kurs < SMA20 UND 1T < 0 → SHORT (Trend)

SCHRITT 3 — SL/TP via ATR:
- SL = 1x ATR14 vom Entry | TP = 1.5x ATR14 vom Entry
- Kein ATR → Asset überspringen

SCHRITT 4 — KONFIDENZ (Basis 60%):
+10% RSI-Extrem (<30/>70) | +10% Trend bestätigt (1T+5T)
+5% Support/Resistance | -10% gegen SMA20
-20% High-Impact Event heute | -10% F&G Kontraindikator | +5% F&G für Richtung
→ Begrenzen auf 40-95%.

SCHRITT 5 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-5x Hebel (≥70%)
- BOLD = zweithöchste, 5x-10x Hebel (≥50%)
- Nur VERFÜGBARE Märkte (kein XETRA)

═══ REGELN ═══
- CFD-Daytrading auf XTB, innerhalb des Tages schließen
- expectedGainPercent = Gewinn bei TP MIT Hebel
- optimalEntry = 2h-Zeitfenster, bevorzuge 14:00-17:00 CET
- marketCloseTime = XTB-Handelsschluss
- Begründung auf Deutsch, 2-3 Sätze — nenne welche Regeln den Trade ausgelöst haben

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_DOUBLE_HOLIDAY = `Du bist ein regelbasierter CFD-Daytrading-Analyst. Doppel-Feiertag — XETRA+NYSE+CME geschlossen. NUR Forex und Krypto. Liquidität reduziert — konservativere Hebel. Führe den Entscheidungsbaum STRIKT aus.

═══ ENTSCHEIDUNGSBAUM ═══

SCHRITT 1 — FILTER:
- RSI14 zwischen 45-55 → eliminieren
- ATR14% < 0.3% → eliminieren
- NEWS-VETO aktiv → eliminieren

SCHRITT 2 — RICHTUNG:
- RSI14 < 35 UND Kurs < SMA20 → LONG
- RSI14 > 65 UND Kurs > SMA20 → SHORT
- RSI14 35-45 UND Kurs > SMA20 UND 1T > 0 → LONG (Trend)
- RSI14 55-65 UND Kurs < SMA20 UND 1T < 0 → SHORT (Trend)

SCHRITT 3 — SL/TP via ATR:
- SL = 1x ATR14 vom Entry | TP = 1.5x ATR14 vom Entry
- Kein ATR → Asset überspringen

SCHRITT 4 — KONFIDENZ (Basis 60%, dann -5% wegen reduzierter Liquidität):
+10% RSI-Extrem (<30/>70) | +10% Trend bestätigt (1T+5T)
+5% Support/Resistance | -10% gegen SMA20
-10% F&G Kontraindikator | +5% F&G für Richtung
→ Begrenzen auf 40-95%.

SCHRITT 5 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-3x Hebel (≥70%, konservativer wegen Feiertag)
- BOLD = zweithöchste, 3x-7x Hebel (≥50%)
- NUR Forex und Krypto — KEINE Rohstoffe

═══ REGELN ═══
- CFD-Daytrading auf XTB, innerhalb des Tages schließen
- expectedGainPercent = Gewinn bei TP MIT Hebel
- optimalEntry = 2h-Zeitfenster
- marketCloseTime = XTB-Handelsschluss
- Begründung auf Deutsch, 2-3 Sätze — nenne welche Regeln den Trade ausgelöst haben

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_US_HOLIDAY = `Du bist ein regelbasierter CFD-Daytrading-Analyst. US-Feiertag — NYSE/NASDAQ geschlossen. EU, Forex, Rohstoffe, Krypto handelbar. Führe den Entscheidungsbaum STRIKT aus.

═══ ENTSCHEIDUNGSBAUM ═══

SCHRITT 1 — FILTER:
- RSI14 zwischen 45-55 → eliminieren
- ATR14% < 0.3% → eliminieren
- Earnings HEUTE/MORGEN → eliminieren
- NEWS-VETO aktiv → eliminieren

SCHRITT 2 — RICHTUNG:
- RSI14 < 35 UND Kurs < SMA20 → LONG
- RSI14 > 65 UND Kurs > SMA20 → SHORT
- RSI14 35-45 UND Kurs > SMA20 UND 1T > 0 → LONG (Trend)
- RSI14 55-65 UND Kurs < SMA20 UND 1T < 0 → SHORT (Trend)

SCHRITT 3 — SL/TP via ATR:
- SL = 1x ATR14 vom Entry | TP = 1.5x ATR14 vom Entry
- Kein ATR → Asset überspringen

SCHRITT 4 — KONFIDENZ (Basis 60%):
+10% RSI-Extrem (<30/>70) | +10% Trend bestätigt (1T+5T)
+5% Support/Resistance | -10% gegen SMA20
-20% High-Impact Event heute | -10% F&G Kontraindikator | +5% F&G für Richtung
→ Begrenzen auf 40-95%.

SCHRITT 5 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-5x Hebel (≥70%)
- BOLD = zweithöchste, 5x-10x Hebel (≥50%)
- Nur VERFÜGBARE Märkte (kein US)

═══ REGELN ═══
- CFD-Daytrading auf XTB, innerhalb des Tages schließen
- expectedGainPercent = Gewinn bei TP MIT Hebel
- optimalEntry = 2h-Zeitfenster, bevorzuge 09:00-11:00 CET für EU, 14:00-16:00 für Forex/Rohstoffe
- marketCloseTime = XTB-Handelsschluss
- Begründung auf Deutsch, 2-3 Sätze — nenne welche Regeln den Trade ausgelöst haben

Antworte ausschließlich mit JSON, kein anderer Text.`;

function getSystemPrompt(dayType: TradingDayType): string {
  if (dayType === "weekend") return SYSTEM_PROMPT_WEEKEND;
  if (dayType === "double_holiday") return SYSTEM_PROMPT_DOUBLE_HOLIDAY;
  if (dayType === "xetra_closed") return SYSTEM_PROMPT_HOLIDAY;
  if (dayType === "nyse_closed") return SYSTEM_PROMPT_US_HOLIDAY;
  return SYSTEM_PROMPT_WEEKDAY;
}

async function fetchRecentPerformance(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const { data: trades } = await supabase
      .from("trades")
      .select("asset, direction, result, category")
      .eq("status", "closed")
      .gte("closed_at", since.toISOString())
      .order("closed_at", { ascending: false });

    if (!trades || trades.length < 3) return null;

    const stats: Record<string, { wins: number; losses: number; total: number }> = {};
    let directionStats = { long: 0, short: 0, longWin: 0, shortWin: 0 };

    for (const t of trades) {
      const cat = t.category || "Sonstige";
      if (!stats[cat]) stats[cat] = { wins: 0, losses: 0, total: 0 };
      stats[cat].total++;
      const won = (t.result ?? 0) > 0;
      if (won) stats[cat].wins++;
      else stats[cat].losses++;

      if (t.direction === "LONG") { directionStats.long++; if (won) directionStats.longWin++; }
      if (t.direction === "SHORT") { directionStats.short++; if (won) directionStats.shortWin++; }
    }

    const lines: string[] = [`Letzte 14 Tage: ${trades.length} geschlossene Trades.`];
    for (const [cat, s] of Object.entries(stats)) {
      lines.push(`${cat}: ${s.wins}/${s.total} profitabel`);
    }
    if (directionStats.long > 0) lines.push(`LONG: ${directionStats.longWin}/${directionStats.long} profitabel`);
    if (directionStats.short > 0) lines.push(`SHORT: ${directionStats.shortWin}/${directionStats.short} profitabel`);
    lines.push("→ Bevorzuge Asset-Klassen und Richtungen mit höherer Trefferquote.");

    return lines.join("\n");
  } catch {
    return null;
  }
}

function buildUserPrompt(marketData: string, date: string, dayType: TradingDayType, marketContext?: string, exchangeNotes?: string[], newsContext?: string, performanceFeedback?: string): string {
  const tradingHoursMap: Record<TradingDayType, string> = {
    weekend: `Handelszeiten (deutsche Zeit):
- Krypto: 24/7 – einziger handelbarer Markt am Wochenende`,
    double_holiday: `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Forex: 24h (Mo–Fr) – eingeschränkte Liquidität
- Krypto: 24/7
- XETRA/EU: GESCHLOSSEN (XETRA-Feiertag)
- NYSE/US: GESCHLOSSEN (NYSE-Feiertag)
- Rohstoffe (CME): GESCHLOSSEN
WICHTIG: NUR Forex und Krypto handelbar!`,
    xetra_closed: `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Index-CFDs (US500, US100, US30): 00:05–23:00
- US-Aktien-CFDs: 15:30–22:00
- Forex: 24h (Mo–Fr)
- Rohstoffe: ~00:00–23:00
- Krypto: 24/7
- XETRA/EU-Aktien/EU-Indizes: GESCHLOSSEN (Börsen-Feiertag)
WICHTIG: marketCloseTime = XTB-Handelsschluss`,
    nyse_closed: `XTB CFD-Handelszeiten (deutsche Zeit / CET):
- Index-CFDs (DE40, EU50, FRA40, UK100, JAP225): 01:15–22:00
- EU-Aktien-CFDs (XETRA): 09:00–17:30
- Forex: 24h (Mo–Fr)
- Rohstoffe (CME): REDUZIERTE ZEITEN ~00:00–19:00/20:30 (Feiertag, früherer Schluss!)
- Krypto: 24/7
- US-Indizes/US-Aktien: GESCHLOSSEN (NYSE-Feiertag)
WICHTIG: marketCloseTime = XTB-Handelsschluss, bei Rohstoffen max 19:00–20:30!`,
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
    double_holiday: "Wähle die 2 absolut besten Setups aus Forex und Krypto. KEINE Rohstoffe (CME geschlossen).",
    xetra_closed: "Wähle die 2 absolut besten Setups aus den VERFÜGBAREN Märkten (kein XETRA).",
    nyse_closed: "Wähle die 2 absolut besten Setups aus den VERFÜGBAREN Märkten (kein US).",
    weekday: "Wähle die 2 absolut besten Setups aus ALLEN Assets.",
  };
  const instruction = instructionMap[dayType];

  const exampleMarket = dayType === "weekend" || dayType === "double_holiday" ? "Krypto" : "XETRA";
  const exampleCategory = dayType === "weekend" || dayType === "double_holiday" ? "Krypto" : "Index";

  const contextBlock = marketContext
    ? `\n${marketContext}\n`
    : "";

  const exchangeBlock = exchangeNotes && exchangeNotes.length > 0
    ? `\nBÖRSEN-HINWEISE:\n${exchangeNotes.join("\n")}\n`
    : "";

  const newsBlock = newsContext
    ? `\nLIVE-NEWS (letzte 12h) — NEWS hat VETO-Recht! Wenn eine Nachricht klar GEGEN ein Asset spricht, setze NEWS-VETO und überspringe es:\n${newsContext}\n`
    : "";

  const performanceBlock = performanceFeedback
    ? `\nPERFORMANCE-FEEDBACK (letzte 14 Tage):\n${performanceFeedback}\n`
    : "";

  return `Datum: ${date}

${tradingHours}
${exchangeBlock}${contextBlock}${newsBlock}${performanceBlock}
Marktdaten:

${marketData}

${instruction} Antworte NUR mit validem JSON — kein Markdown, keine Code-Blöcke, kein Text davor oder danach:

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

// ── Pre-Analysis Prompt (Morgen-Scan) ──────────────────

const SYSTEM_PROMPT_SCAN = `Du bist ein regelbasierter CFD-Daytrading-Analyst. Deine Aufgabe: erstelle eine SHORTLIST von 4-6 Kandidaten für den heutigen Handelstag. KEINE finalen Signale — nur eine Vorauswahl.

WICHTIG: Antworte NUR mit validem JSON. Kein Markdown, keine Code-Blöcke, kein Text davor oder danach.

═══ ENTSCHEIDUNGSBAUM ═══

SCHRITT 1 — FILTER (Assets eliminieren):
- RSI14 zwischen 45-55 → eliminieren
- ATR14% < 0.3% → eliminieren
- Earnings HEUTE oder MORGEN → eliminieren
- NEWS-VETO aktiv → eliminieren

SCHRITT 2 — RICHTUNG bestimmen:
- RSI14 < 35 UND Kurs < SMA20 → LONG-Tendenz
- RSI14 > 65 UND Kurs > SMA20 → SHORT-Tendenz
- RSI14 35-45 UND Kurs > SMA20 UND 1T > 0 → LONG-Tendenz
- RSI14 55-65 UND Kurs < SMA20 UND 1T < 0 → SHORT-Tendenz

SCHRITT 3 — VORLÄUFIGE KONFIDENZ (Basis 60%):
+10% RSI-Extrem (<30/>70) | +10% Trend bestätigt (1T+5T)
+5% Support/Resistance | -10% gegen SMA20
-20% High-Impact Event heute | -10% F&G Kontraindikator | +5% F&G für Richtung
→ Begrenzen auf 40-95%.

SCHRITT 4 — TOP 4-6 nach Konfidenz auswählen
- Mindestens 1 SHORT dabei wenn möglich
- Verschiedene Asset-Klassen bevorzugen

Antworte NUR mit validem JSON — kein Markdown, keine Code-Blöcke, kein Text davor oder danach:
{
  "candidates": [
    {
      "asset": "Name",
      "ticker": "XTB-Ticker",
      "category": "Index",
      "market": "XETRA",
      "direction": "LONG",
      "confidence": 72,
      "note": "RSI 32 + unter SMA20, überverkauft. ATR 1.2%."
    }
  ]
}`;

export interface ScanCandidate {
  asset: string;
  ticker: string;
  category: string;
  market: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  note: string;
}

export async function generatePreAnalysis(): Promise<ScanCandidate[]> {
  const dayType = getTradingDayType();
  console.log("Morgen-Scan: Pre-Analysis wird generiert...");

  const [marketData, marketContext, newsContext] = await Promise.all([
    fetchMarketDataForDayType(dayType),
    fetchMarketContext(),
    fetchNewsContext(),
  ]);

  if (newsContext) {
    console.log(`Live-News geladen: ${newsContext.headlines.length} Meldungen`);
  }

  const minAssets = dayType === "weekend" ? 3 : dayType === "double_holiday" ? 8 : 5;
  if (marketData.length < minAssets) {
    throw new Error(`Zu wenig Marktdaten (${marketData.length}). Mindestens ${minAssets} benötigt.`);
  }

  console.log(`${marketData.length} Assets geladen. Pre-Analysis via Claude...`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const formattedData = formatMarketDataForPrompt(marketData);
  const formattedContext = formatMarketContextForPrompt(marketContext);
  const exchangeNotes = getExchangeNotes();
  const newsBlock = newsContext?.raw
    ? `\nLIVE-NEWS (letzte 12h) — NEWS hat VETO-Recht:\n${newsContext.raw}\n`
    : "";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: SYSTEM_PROMPT_SCAN,
    messages: [{
      role: "user",
      content: `Datum: ${today}

${formattedContext}
${newsBlock}
Marktdaten:

${formattedData}

Erstelle eine Shortlist von 4-6 Kandidaten. Antworte NUR mit JSON.`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Text-Antwort von Claude erhalten");
  }

  let parsed: { candidates: ScanCandidate[] };
  try {
    let jsonText = textBlock.text;
    const codeBlock = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonText = codeBlock[1];
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Kein JSON");
    const cleaned = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Claude Scan-Antwort:", textBlock.text);
    throw new Error(`JSON-Parsing fehlgeschlagen: ${err}`);
  }

  if (!parsed.candidates || parsed.candidates.length < 2) {
    throw new Error("Weniger als 2 Kandidaten in der Pre-Analysis");
  }

  console.log(`Pre-Analysis: ${parsed.candidates.length} Kandidaten — ${parsed.candidates.map(c => c.asset).join(", ")}`);
  return parsed.candidates;
}

// Marktdaten je nach Tagestyp laden
async function fetchMarketDataForDayType(dayType: TradingDayType): Promise<AssetMarketData[]> {
  if (dayType === "weekend") {
    return fetchCryptoMarketData();
  }

  if (dayType === "double_holiday") {
    // Doppel-Feiertag = XETRA + NYSE + CME geschlossen → nur Forex + Krypto
    return fetchForexAndCryptoData();
  }

  if (dayType === "xetra_closed") {
    return fetchNonXetraMarketData();
  }

  if (dayType === "nyse_closed") {
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

export async function generateSignals(shortlist?: ScanCandidate[]): Promise<{
  steady: GeneratedSignal;
  bold: GeneratedSignal;
}> {
  const dayType = getTradingDayType();
  const modeLabels: Record<TradingDayType, string> = {
    weekend: "Wochenende (nur Krypto)",
    double_holiday: "Doppel-Feiertag (nur Forex/Krypto, CME auch geschlossen)",
    xetra_closed: "XETRA-Feiertag (ohne XETRA)",
    nyse_closed: "NYSE-Feiertag (ohne US)",
    weekday: "Wochentag (alle Assets)",
  };
  const modeLabel = modeLabels[dayType];

  console.log(`Modus: ${modeLabel}`);

  // 1. Marktdaten + Kontext + News + Performance parallel laden
  const [allMarketData, marketContext, newsContext, performanceFeedback] = await Promise.all([
    fetchMarketDataForDayType(dayType),
    fetchMarketContext(),
    fetchNewsContext(),
    fetchRecentPerformance(),
  ]);

  if (newsContext) {
    console.log(`Live-News geladen: ${newsContext.headlines.length} Meldungen`);
  }

  // Bei Shortlist: nur relevante Assets an Claude senden (frische Daten für alle geladen)
  let marketData = allMarketData;
  if (shortlist && shortlist.length > 0) {
    const shortlistTickers = new Set(shortlist.map(c => c.ticker));
    marketData = allMarketData.filter(d => shortlistTickers.has(d.ticker));
    console.log(`Shortlist-Modus: ${marketData.length} von ${allMarketData.length} Assets an Claude`);
  }

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

  const minAssets = dayType === "weekend" ? 3 : dayType === "double_holiday" ? 8 : 5;
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
  const exchangeNotes = getExchangeNotes();

  if (exchangeNotes.length > 0) {
    console.log(`Börsen-Hinweise: ${exchangeNotes.join(" | ")}`);
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: getSystemPrompt(dayType),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(formattedData, today, dayType, formattedContext, exchangeNotes, newsContext?.raw, performanceFeedback ?? undefined),
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
    let jsonText = textBlock.text;
    const codeBlock = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonText = codeBlock[1];
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Kein JSON in der Antwort gefunden");
    const cleaned = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
    parsed = JSON.parse(cleaned);
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

  // SL-Mindestabstände erzwingen (ATR-basiert, Fallback auf feste %)
  enforceMinSlDistance(parsed.steady, allMarketData);
  enforceMinSlDistance(parsed.bold, allMarketData);

  console.log(
    `Signale generiert: ${parsed.steady.asset} (Steady, ${parsed.steady.market}) + ${parsed.bold.asset} (Bold, ${parsed.bold.market})`
  );

  return parsed;
}

// ── SL-Mindestabstand erzwingen (ATR-basiert mit Fallback) ──────────────────

const FALLBACK_MIN_SL_PERCENT: Record<string, number> = {
  Index: 0.8,
  Aktie: 1.0,
  Rohstoff: 1.5,
  Forex: 0.3,
  Krypto: 2.0,
};

function enforceMinSlDistance(signal: GeneratedSignal, marketData: AssetMarketData[]): void {
  const assetData = marketData.find(d => d.ticker === signal.ticker || d.name === signal.asset);
  const atr = assetData?.atr14;

  // ATR-basiert: SL muss mindestens 1x ATR vom Entry entfernt sein
  let minDistance: number;
  if (atr && atr > 0) {
    minDistance = atr;
  } else {
    const fallbackPct = FALLBACK_MIN_SL_PERCENT[signal.category] ?? 1.0;
    minDistance = signal.entry * (fallbackPct / 100);
  }

  const currentDist = Math.abs(signal.entry - signal.stopLoss);
  if (currentDist >= minDistance) return;

  const oldSl = signal.stopLoss;
  if (signal.direction === "LONG") {
    signal.stopLoss = Math.round((signal.entry - minDistance) * 10000) / 10000;
  } else {
    signal.stopLoss = Math.round((signal.entry + minDistance) * 10000) / 10000;
  }

  // TP auf 1.5x ATR setzen wenn SL korrigiert wurde
  const tpDistance = minDistance * 1.5;
  if (signal.direction === "LONG") {
    signal.takeProfit = Math.round((signal.entry + tpDistance) * 10000) / 10000;
  } else {
    signal.takeProfit = Math.round((signal.entry - tpDistance) * 10000) / 10000;
  }

  const source = atr ? "ATR" : "Fallback";
  console.log(
    `SL/TP-Korrektur [${source}] (${signal.asset}): SL ${oldSl} → ${signal.stopLoss}, TP → ${signal.takeProfit}`
  );
}
