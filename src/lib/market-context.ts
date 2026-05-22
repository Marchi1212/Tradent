// Zusätzliche Markt-Kontextdaten für bessere Signalqualität
// Quellen: Yahoo Finance (Earnings), ForexFactory (Wirtschaftskalender), alternative.me (Fear & Greed)

import { WATCHLIST } from "./market-data";

// ── Fear & Greed Index ──────────────────────────

export interface FearGreedData {
  value: number;           // 0-100
  classification: string;  // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  interpretation: string;  // Anweisung für Claude
}

export async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const entry = json?.data?.[0];
    if (!entry) return null;

    const value = parseInt(entry.value, 10);
    const classification = entry.value_classification;

    // Interpretation als Kontraindikator
    let interpretation: string;
    if (value <= 20) {
      interpretation = "EXTREME ANGST – Kontraindikator: Märkte oft überverkauft. LONG-Setups bevorzugen, Konfidenz für LONG +5-10%.";
    } else if (value <= 35) {
      interpretation = "ANGST – Leicht bullisher Bias möglich. Keine drastische Anpassung, aber LONG-Setups leicht bevorzugen.";
    } else if (value >= 80) {
      interpretation = "EXTREME GIER – Kontraindikator: Märkte oft überkauft. SHORT-Setups bevorzugen, Konfidenz für LONG -5-10%.";
    } else if (value >= 65) {
      interpretation = "GIER – Leicht bearisher Bias möglich. Keine drastische Anpassung, aber Vorsicht bei aggressiven LONG-Setups.";
    } else {
      interpretation = "NEUTRAL – Kein Sentiment-Einfluss auf die Signalgebung.";
    }

    return { value, classification, interpretation };
  } catch (err) {
    console.error("Fear & Greed Index laden fehlgeschlagen:", err);
    return null;
  }
}

// ── Earnings-Kalender ───────────────────────────

export interface EarningsInfo {
  ticker: string;
  name: string;
  earningsDate: string;      // "2026-07-30"
  daysUntilEarnings: number;
  isEstimate: boolean;
}

// Yahoo Finance Crumb für authentifizierte Requests
async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    // Step 1: Cookie holen
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });

    const setCookie = cookieRes.headers.get("set-cookie") || "";

    // Step 2: Crumb holen
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)",
        Cookie: setCookie,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    return { crumb, cookie: setCookie };
  } catch (err) {
    console.error("Yahoo Crumb fehlgeschlagen:", err);
    return null;
  }
}

export async function fetchEarningsForStocks(): Promise<EarningsInfo[]> {
  // Nur Aktien aus der Watchlist (haben Yahoo-Symbole und Earnings)
  const stocks = WATCHLIST.filter((a) => a.category === "Aktie");
  if (stocks.length === 0) return [];

  const auth = await getYahooCrumb();
  if (!auth) {
    console.error("Yahoo Auth fehlgeschlagen – keine Earnings-Daten");
    return [];
  }

  const today = new Date();
  const results: EarningsInfo[] = [];

  // In Batches laden (max 5 parallel)
  const batchSize = 5;
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (stock) => {
        try {
          const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(stock.symbol)}?modules=calendarEvents&crumb=${encodeURIComponent(auth.crumb)}`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)",
              Cookie: auth.cookie,
            },
            signal: AbortSignal.timeout(8000),
          });

          if (!res.ok) return null;
          const json = await res.json();
          const earnings = json?.quoteSummary?.result?.[0]?.calendarEvents?.earnings;
          if (!earnings?.earningsDate?.[0]) return null;

          const earningsDate = new Date(earnings.earningsDate[0].raw * 1000);
          const daysUntil = Math.ceil((earningsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Nur relevant wenn Earnings innerhalb der nächsten 7 Tage
          if (daysUntil < 0 || daysUntil > 7) return null;

          return {
            ticker: stock.ticker,
            name: stock.name,
            earningsDate: earnings.earningsDate[0].fmt,
            daysUntilEarnings: daysUntil,
            isEstimate: earnings.isEarningsDateEstimate ?? true,
          };
        } catch {
          return null;
        }
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }

    if (i + batchSize < stocks.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

// ── Wirtschaftskalender ─────────────────────────

export interface EconomicEvent {
  title: string;
  country: string;     // USD, EUR, GBP, etc.
  date: string;        // ISO date
  impact: string;      // "High", "Medium", "Low"
  forecast: string;
  previous: string;
}

export async function fetchEconomicCalendar(): Promise<EconomicEvent[]> {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];
    const events: Array<{
      title: string;
      country: string;
      date: string;
      impact: string;
      forecast: string;
      previous: string;
    }> = await res.json();

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Nur High-Impact Events von heute filtern
    return events
      .filter((e) => {
        if (e.impact !== "High") return false;
        const eventDate = e.date.split("T")[0];
        return eventDate === todayStr;
      })
      .map((e) => ({
        title: e.title,
        country: e.country,
        date: e.date,
        impact: e.impact,
        forecast: e.forecast || "",
        previous: e.previous || "",
      }));
  } catch (err) {
    console.error("Wirtschaftskalender laden fehlgeschlagen:", err);
    return [];
  }
}

// ── Alles zusammen laden ────────────────────────

export interface MarketContext {
  fearGreed: FearGreedData | null;
  earnings: EarningsInfo[];
  economicEvents: EconomicEvent[];
}

export async function fetchMarketContext(): Promise<MarketContext> {
  const [fearGreed, earnings, economicEvents] = await Promise.all([
    fetchFearGreedIndex(),
    fetchEarningsForStocks(),
    fetchEconomicCalendar(),
  ]);

  return { fearGreed, earnings, economicEvents };
}

// ── Prompt-Formatierung ─────────────────────────

export function formatMarketContextForPrompt(ctx: MarketContext): string {
  const sections: string[] = [];

  // Fear & Greed
  if (ctx.fearGreed) {
    sections.push(
      `MARKTSTIMMUNG (Fear & Greed Index):
Aktueller Wert: ${ctx.fearGreed.value}/100 – ${ctx.fearGreed.classification}
${ctx.fearGreed.interpretation}`
    );
  }

  // Earnings
  if (ctx.earnings.length > 0) {
    const earningsLines = ctx.earnings.map((e) => {
      const tag = e.daysUntilEarnings === 0
        ? "HEUTE"
        : e.daysUntilEarnings === 1
          ? "MORGEN"
          : `in ${e.daysUntilEarnings} Tagen`;
      return `- ${e.name} (${e.ticker}): Earnings ${tag} (${e.earningsDate})${e.isEstimate ? " [geschätzt]" : ""}`;
    });

    sections.push(
      `EARNINGS-KALENDER (nächste 7 Tage):
${earningsLines.join("\n")}
WICHTIG: Aktien mit Earnings HEUTE oder MORGEN haben erhöhte Volatilität. Konfidenz um 20-30% senken oder Asset meiden.`
    );
  }

  // Wirtschaftskalender
  if (ctx.economicEvents.length > 0) {
    const eventLines = ctx.economicEvents.map((e) => {
      const time = new Date(e.date).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      return `- ${time} ${e.country}: ${e.title}${e.forecast ? ` (Prognose: ${e.forecast}, Vorher: ${e.previous})` : ""}`;
    });

    sections.push(
      `WIRTSCHAFTSKALENDER HEUTE (nur High-Impact):
${eventLines.join("\n")}
WICHTIG: Bei FOMC/EZB-Zinsentscheiden oder NFP/CPI-Releases → betroffene Märkte meiden oder Hebel halbieren. Diese Events verursachen extreme Volatilität.`
    );
  }

  if (sections.length === 0) {
    return "MARKTKONTEXT: Keine besonderen Events oder Stimmungs-Extreme heute. Analyse rein technisch.";
  }

  return sections.join("\n\n");
}
