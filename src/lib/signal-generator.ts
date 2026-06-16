import Anthropic from "@anthropic-ai/sdk";
import { fetchMarketDataForSession, fetchCryptoMarketData, fetchNonXetraMarketData, fetchGlobalMarketData, fetchNonUSMarketData, fetchForexAndCryptoData, analyzeAsset, type AssetMarketData, type ConfidenceResult } from "./market-data";
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

interface AnalyzedAsset {
  data: AssetMarketData;
  analysis: ConfidenceResult;
}

function preAnalyzeAssets(data: AssetMarketData[]): AnalyzedAsset[] {
  return data
    .map((d) => ({ data: d, analysis: analyzeAsset(d) }))
    .filter((a) => !a.analysis.filtered)
    .sort((a, b) => b.analysis.confidence - a.analysis.confidence);
}

function formatMarketDataForPrompt(data: AssetMarketData[]): string {
  return data
    .map(
      (d) => {
        const macdStr = d.macd
          ? `MACD: ${d.macd.macd} | Signal: ${d.macd.signal} | Histogramm: ${d.macd.histogram}`
          : "MACD: n/a";
        const bbStr = d.bollingerBands
          ? `BB-Oben: ${d.bollingerBands.upper} | BB-Unten: ${d.bollingerBands.lower} | BB-Breite: ${d.bollingerBands.width}%`
          : "Bollinger: n/a";
        const volStr = d.volume
          ? `Volumen: ${(d.volume.current / 1e6).toFixed(1)}M | Ø20T: ${(d.volume.avg20 / 1e6).toFixed(1)}M | Ratio: ${d.volume.ratio}x`
          : "Volumen: n/a";
        return `${d.name} (${d.ticker}) | ${d.category} | ${d.market}
  Kurs: ${d.currentPrice} | 1T: ${d.change1dPercent > 0 ? "+" : ""}${d.change1dPercent}% | 5T: ${d.change5dPercent > 0 ? "+" : ""}${d.change5dPercent}%
  5T-Hoch: ${d.high5d} | 5T-Tief: ${d.low5d} | SMA20: ${d.sma20 ?? "n/a"} | RSI14: ${d.rsi14 ?? "n/a"}
  ATR14: ${d.atr14 ?? "n/a"} (${d.atr14Percent != null ? d.atr14Percent + "%" : "n/a"} vom Kurs)
  ${macdStr}
  ${bbStr}
  ${volStr}
  Support: ${d.support ?? "n/a"} | Resistance: ${d.resistance ?? "n/a"}`;
      }
    )
    .join("\n\n");
}

function formatAnalyzedAssetsForPrompt(assets: AnalyzedAsset[]): string {
  return assets
    .map((a) => {
      const d = a.data;
      const c = a.analysis;
      return `${d.name} (${d.ticker}) | ${d.category} | ${d.market}
  VORBERECHNET: ${c.direction} | Konfidenz: ${c.confidence}% | Momentum: +${c.components.momentum}% | Trend: +${c.components.trend}% | Volumen: +${c.components.volume}% | Strafen: ${c.components.penalties}%
  Gründe: ${c.reasons.join(", ")}
  Kurs: ${d.currentPrice} | 1T: ${d.change1dPercent > 0 ? "+" : ""}${d.change1dPercent}% | 5T: ${d.change5dPercent > 0 ? "+" : ""}${d.change5dPercent}%
  5T-Hoch: ${d.high5d} | 5T-Tief: ${d.low5d} | SMA20: ${d.sma20 ?? "n/a"} | RSI14: ${d.rsi14 ?? "n/a"}
  ATR14: ${d.atr14 ?? "n/a"} (${d.atr14Percent != null ? d.atr14Percent + "%" : "n/a"} vom Kurs)
  Support: ${d.support ?? "n/a"} | Resistance: ${d.resistance ?? "n/a"}`;
    })
    .join("\n\n");
}

const SYSTEM_PROMPT_WEEKDAY = `Du bist ein CFD-Daytrading-Analyst. Die technische Analyse (Richtung, Konfidenz, Indikatoren) wurde VORBERECHNET und ist bei jedem Asset angegeben. Du rechnest NICHT selbst.

═══ DEINE AUFGABE ═══

Du bekommst eine VORBEREITETE LISTE von Assets mit:
- Vorberechneter Richtung (LONG/SHORT)
- Vorberechneter Konfidenz (%) mit Aufschlüsselung (Momentum, Trend, Volumen, Strafen)
- Gründen für die Bewertung

DEINE ROLLE — Qualitative Prüfung und Auswahl:

SCHRITT 1 — NEWS-VETO:
- Prüfe den News-Block. Hat ein Asset ein NEWS-VETO? → Überspringen.
- Earnings HEUTE/MORGEN → Überspringen.
- High-Impact Event (FOMC, NFP, CPI, EZB) → Asset KOMPLETT überspringen (kein Trade vor solchen Events).

SCHRITT 2 — KONFIDENZ ANPASSEN (nur qualitative Faktoren):
Die vorberechnete Konfidenz ist dein Ausgangspunkt. Du darfst NUR diese qualitativen Anpassungen vornehmen:
- News-Unterstützung: bis +5% wenn aktuelle Nachrichten die Richtung klar bestätigen
- News-Widerspruch: bis -10% wenn Nachrichten gegen die Richtung sprechen
- Fear & Greed: -5% wenn F&G gegen die Richtung spricht (>80 bei LONG, <20 bei SHORT), +3% wenn F&G als Kontraindikator die Richtung stützt
→ Begrenzen auf 40-95%.

SCHRITT 3 — SL/TP setzen (ATR-basiert, PFLICHT):
- Stop-Loss = 1x ATR14 vom Entry (LONG: Entry - ATR14, SHORT: Entry + ATR14)
- Take-Profit = 1.5x ATR14 vom Entry (LONG: Entry + 1.5×ATR14, SHORT: Entry - 1.5×ATR14)
- Prüfe Support/Resistance: SL bei LONG unter Support, SL bei SHORT über Resistance
- Kein ATR → Überspringen

SCHRITT 4 — AUSWAHL:
- STEADY = höchste Konfidenz, Hebel 2x-5x (Konfidenz ≥65%)
- BOLD = zweithöchste Konfidenz, Hebel 5x-10x (Konfidenz ≥50%)
- Beide Assets MÜSSEN unterschiedlich sein
- KORRELATIONS-CHECK: gleicher Sektor/Region + gleiche 5T-Richtung = korreliert → ersetze schwächeres
- LONG und SHORT sind BEIDE erwünscht — kein Bias!

═══ REGELN ═══
- CFD-Daytrading auf XTB, innerhalb des Tages schließen
- expectedGainPercent = Gewinn bei TP MIT Hebel
- optimalEntry = 2h-Zeitfenster, MAXIMAL 2 Stunden breit. Bevorzuge 14:00-17:00 CET (London-NY-Overlap).
- marketCloseTime = XTB-Handelsschluss
- Begründung auf Deutsch, 2-3 Sätze — nenne die vorberechneten Gründe und deine qualitative Einschätzung

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_WEEKEND = `Du bist ein Krypto-Daytrading-Analyst. Wochenende — nur Krypto handelbar. Technische Analyse ist VORBERECHNET.

═══ DEINE AUFGABE ═══

Assets kommen mit vorberechneter Richtung + Konfidenz. Du rechnest NICHT selbst.

SCHRITT 1 — NEWS-VETO: Prüfe News-Block. Veto → überspringen.

SCHRITT 2 — KONFIDENZ ANPASSEN (nur qualitativ):
Vorberechnete Konfidenz ist Ausgangspunkt. Nur diese Anpassungen:
- News bestätigen Richtung: bis +5%
- News widersprechen: bis -10%
- F&G gegen Richtung: -5% | F&G als Kontraindikator: +3%
- Krypto-Wochenend-Volatilität (oft niedriger, plötzliche Spikes): bis -5%
→ Begrenzen auf 40-95%.

SCHRITT 3 — SL/TP (ATR-basiert):
SL = 1x ATR14 | TP = 1.5x ATR14 | Prüfe S/R-Level | Kein ATR → überspringen

SCHRITT 4 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-5x Hebel (≥65%)
- BOLD = zweithöchste, 5x-10x Hebel (≥50%)
- KORRELATIONS-CHECK: nicht zwei ähnliche Kryptos

═══ REGELN ═══
- Krypto-CFDs auf XTB, Daytrading | marketCloseTime = "21:00"
- Begründung auf Deutsch, 2-3 Sätze — nenne vorberechnete Gründe + deine qualitative Einschätzung

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_HOLIDAY = `Du bist ein CFD-Daytrading-Analyst. XETRA-Feiertag — EU-Börsen geschlossen. US, Forex, Rohstoffe, Krypto handelbar. Technische Analyse ist VORBERECHNET.

═══ DEINE AUFGABE ═══

Assets kommen mit vorberechneter Richtung + Konfidenz. Du rechnest NICHT selbst.

SCHRITT 1 — NEWS-VETO + EVENTS:
- News-Veto → überspringen
- Earnings HEUTE/MORGEN → überspringen
- FOMC/NFP/CPI/EZB heute → Asset KOMPLETT überspringen

SCHRITT 2 — KONFIDENZ ANPASSEN (nur qualitativ):
- News bestätigen: bis +5% | News widersprechen: bis -10%
- F&G gegen Richtung: -5% | F&G Kontraindikator: +3%
→ Begrenzen auf 40-95%.

SCHRITT 3 — SL/TP (ATR-basiert):
SL = 1x ATR14 | TP = 1.5x ATR14 | Prüfe S/R-Level | Kein ATR → überspringen

SCHRITT 4 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-5x Hebel (≥65%)
- BOLD = zweithöchste, 5x-10x Hebel (≥50%)
- KORRELATIONS-CHECK | Nur verfügbare Märkte (kein XETRA)

═══ REGELN ═══
- CFD-Daytrading auf XTB | optimalEntry = 2h-Zeitfenster, bevorzuge 14:00-17:00 CET
- Begründung auf Deutsch, 2-3 Sätze

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_DOUBLE_HOLIDAY = `Du bist ein CFD-Daytrading-Analyst. Doppel-Feiertag — XETRA+NYSE+CME geschlossen. NUR Forex und Krypto. Liquidität reduziert. Technische Analyse ist VORBERECHNET.

═══ DEINE AUFGABE ═══

Assets kommen mit vorberechneter Richtung + Konfidenz. Du rechnest NICHT selbst.
WICHTIG: Reduzierte Liquidität — ziehe pauschal 5% von der vorberechneten Konfidenz ab.

SCHRITT 1 — NEWS-VETO: Prüfe News-Block. Veto → überspringen.

SCHRITT 2 — KONFIDENZ ANPASSEN (nur qualitativ):
- Liquiditäts-Abzug: -5% (automatisch wegen Doppel-Feiertag)
- News bestätigen: bis +5% | News widersprechen: bis -10%
- F&G gegen Richtung: -5% | F&G Kontraindikator: +3%
→ Begrenzen auf 40-95%.

SCHRITT 3 — SL/TP (ATR-basiert):
SL = 1x ATR14 | TP = 1.5x ATR14 | Prüfe S/R-Level | Kein ATR → überspringen

SCHRITT 4 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-3x Hebel (≥65%, konservativ)
- BOLD = zweithöchste, 3x-7x Hebel (≥50%)
- KORRELATIONS-CHECK | NUR Forex und Krypto

═══ REGELN ═══
- CFD-Daytrading auf XTB | Begründung auf Deutsch, 2-3 Sätze

Antworte ausschließlich mit JSON, kein anderer Text.`;

const SYSTEM_PROMPT_US_HOLIDAY = `Du bist ein CFD-Daytrading-Analyst. US-Feiertag — NYSE/NASDAQ geschlossen. EU, Forex, Rohstoffe, Krypto handelbar. Technische Analyse ist VORBERECHNET.

═══ DEINE AUFGABE ═══

Assets kommen mit vorberechneter Richtung + Konfidenz. Du rechnest NICHT selbst.

SCHRITT 1 — NEWS-VETO + EVENTS:
- News-Veto → überspringen | Earnings → überspringen
- FOMC/NFP/CPI/EZB → KOMPLETT überspringen

SCHRITT 2 — KONFIDENZ ANPASSEN (nur qualitativ):
- News bestätigen: bis +5% | News widersprechen: bis -10%
- F&G gegen Richtung: -5% | F&G Kontraindikator: +3%
→ Begrenzen auf 40-95%.

SCHRITT 3 — SL/TP (ATR-basiert):
SL = 1x ATR14 | TP = 1.5x ATR14 | Prüfe S/R-Level | Kein ATR → überspringen

SCHRITT 4 — AUSWAHL:
- STEADY = höchste Konfidenz, 2x-5x Hebel (≥65%)
- BOLD = zweithöchste, 5x-10x Hebel (≥50%)
- KORRELATIONS-CHECK | Nur verfügbare Märkte (kein US)
- optimalEntry: 09:00-11:00 CET für EU, 14:00-16:00 für Forex/Rohstoffe

═══ REGELN ═══
- CFD-Daytrading auf XTB | Begründung auf Deutsch, 2-3 Sätze

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
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

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
VORBERECHNETE KANDIDATEN (Filter + Richtung + Konfidenz im Code berechnet):

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

const SYSTEM_PROMPT_SCAN = `Du bist ein CFD-Daytrading-Analyst. Deine Aufgabe: prüfe die VORBERECHNETE Kandidatenliste und erstelle eine SHORTLIST von 4-6 Assets für heute. KEINE finalen Signale — nur Vorauswahl.

WICHTIG: Antworte NUR mit validem JSON. Kein Markdown, keine Code-Blöcke, kein Text davor oder danach.

═══ DEINE AUFGABE ═══

Die technische Analyse (Filter, Richtung, Konfidenz) ist VORBERECHNET. Jedes Asset hat bereits:
- Richtung (LONG/SHORT) basierend auf RSI + SMA20 + MACD-Bestätigung
- Konfidenz (%) aus gruppenbasiertem Scoring (Momentum, Trend, Volumen)
- Auflistung der Gründe

DU PRÜFST NUR:
1. NEWS-VETO — hat ein Asset ein klares News-Veto? → Entfernen.
2. Earnings HEUTE/MORGEN → Entfernen.
3. KORRELATIONS-CHECK — keine zwei stark korrelierten Assets (gleicher Sektor + gleiche Richtung + ähnliche 5T-Bewegung).
4. Mindestens 1 SHORT dabei wenn möglich.
5. Verschiedene Asset-Klassen bevorzugen.

Übernimm Richtung und Konfidenz wie vorberechnet. Du darfst die Konfidenz nur bei News-Einfluss anpassen (bis ±5%).

Antworte NUR mit validem JSON.
WICHTIG: "note" maximal 80 Zeichen — nur Schlüsselindikatoren, keine ganzen Sätze.
{
  "candidates": [
    {
      "asset": "Name",
      "ticker": "XTB-Ticker",
      "category": "Index",
      "market": "XETRA",
      "direction": "LONG",
      "confidence": 72,
      "note": "RSI 32, MACD +0.5, Vol 1.8x, nahe Support. ATR 1.2%."
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

  console.log(`${marketData.length} Assets geladen. Pre-Analyse im Code...`);

  // Technische Analyse im Code (deterministisch)
  const analyzed = preAnalyzeAssets(marketData);
  console.log(`${analyzed.length} Assets bestehen Filter (von ${marketData.length}). Top-Kandidaten an Claude...`);

  // Nur die Top-15 an Claude senden (sortiert nach Konfidenz)
  const topCandidates = analyzed.slice(0, 15);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const formattedData = formatAnalyzedAssetsForPrompt(topCandidates);
  const formattedContext = formatMarketContextForPrompt(marketContext);
  const newsBlock = newsContext?.raw
    ? `\nLIVE-NEWS (letzte 12h) — NEWS hat VETO-Recht:\n${newsContext.raw}\n`
    : "";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT_SCAN,
    messages: [{
      role: "user",
      content: `Datum: ${today}

${formattedContext}
${newsBlock}
VORBERECHNETE KANDIDATEN (sortiert nach Konfidenz, Filter + Richtung + Konfidenz im Code berechnet):

${formattedData}

Prüfe qualitativ (News, Korrelation, Diversifikation) und wähle 4-6 Kandidaten. Antworte NUR mit JSON.`,
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

  console.log(`${marketData.length} Assets geladen. Technische Analyse im Code...`);

  // Pre-Analyse im Code (deterministisch)
  const analyzed = preAnalyzeAssets(marketData);
  console.log(`${analyzed.length} Assets bestehen Filter. Qualitative Prüfung via Claude...`);

  // 2. Claude API aufrufen
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const analyzedData = formatAnalyzedAssetsForPrompt(analyzed.slice(0, 10));
  const formattedContext = formatMarketContextForPrompt(marketContext);
  const exchangeNotes = getExchangeNotes();

  if (exchangeNotes.length > 0) {
    console.log(`Börsen-Hinweise: ${exchangeNotes.join(" | ")}`);
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: getSystemPrompt(dayType),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(analyzedData, today, dayType, formattedContext, exchangeNotes, newsContext?.raw, performanceFeedback ?? undefined),
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

  // Diversitäts-Check: Steady und Bold MÜSSEN verschiedene Assets sein
  if (parsed.steady.ticker === parsed.bold.ticker || parsed.steady.asset === parsed.bold.asset) {
    console.warn(`Gleiches Asset für beide: ${parsed.steady.asset} — ersetze Bold durch nächstbesten Kandidaten`);
    const alternativeAssets = analyzed.filter(
      a => a.data.ticker !== parsed.steady.ticker && a.analysis.direction !== null && a.analysis.confidence >= 50
    );
    if (alternativeAssets.length > 0) {
      const alt = alternativeAssets[0];
      const d = alt.data;
      const a = alt.analysis;
      const entry = d.currentPrice;
      const atr = d.atr14 ?? entry * 0.02;
      const dir = a.direction as "LONG" | "SHORT";
      parsed.bold = {
        asset: d.name,
        ticker: d.ticker,
        direction: dir,
        riskClass: "bold",
        leverage: a.confidence >= 65 ? "7x" : "5x",
        entry,
        stopLoss: dir === "LONG" ? +(entry - atr).toFixed(4) : +(entry + atr).toFixed(4),
        takeProfit: dir === "LONG" ? +(entry + 1.5 * atr).toFixed(4) : +(entry - 1.5 * atr).toFixed(4),
        confidence: a.confidence,
        expectedGainPercent: +(((1.5 * atr) / entry) * 100 * (a.confidence >= 65 ? 7 : 5)).toFixed(1),
        riskRewardRatio: "1:1.5",
        reasoning: `${d.name} ${dir}: ${a.reasons.join(", ")}. Auto-Ersatz wegen Diversitätsregel.`,
        market: d.category === "Krypto" ? "Krypto" : d.category === "Forex" ? "Forex" : d.category === "Rohstoff" ? "Rohstoff" : "Aktie",
        marketCloseTime: d.category === "Krypto" ? "23:59" : "22:00",
        optimalEntry: "14:00–16:00",
        category: d.category,
      };
      console.log(`Bold ersetzt durch: ${parsed.bold.asset} (${parsed.bold.direction})`);
    }
  }

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
