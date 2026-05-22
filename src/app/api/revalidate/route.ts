import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

// Aktuellen Kurs von Yahoo Finance laden
async function fetchCurrentPrice(ticker: string, yahooSymbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter((c: number | null) => c != null);
    return validCloses.length > 0 ? validCloses[validCloses.length - 1] : null;
  } catch {
    return null;
  }
}

// Yahoo-Symbol aus Watchlist finden
function getYahooSymbol(ticker: string): string {
  const map: Record<string, string> = {
    DE40: "^GDAXI", US500: "^GSPC", US100: "^NDX", US30: "^DJI",
    UK100: "^FTSE", FRA40: "^FCHI", EU50: "^STOXX50E", JAP225: "^N225",
    "TSLA.US": "TSLA", "NVDA.US": "NVDA", "AAPL.US": "AAPL",
    "MSFT.US": "MSFT", "AMZN.US": "AMZN", "META.US": "META",
    "GOOGL.US": "GOOGL", "AMD.US": "AMD", "NFLX.US": "NFLX",
    "INTC.US": "INTC", "BA.US": "BA", "JPM.US": "JPM",
    "GS.US": "GS", "DIS.US": "DIS", "KO.US": "KO",
    "SAP.DE": "SAP.DE", "SIE.DE": "SIE.DE", "ASML.NL": "ASML.AS",
    "LVMH.FR": "MC.PA", "VOW.DE": "VOW3.DE", "DBK.DE": "DBK.DE",
    EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
    USDCHF: "USDCHF=X", EURGBP: "EURGBP=X", AUDUSD: "AUDUSD=X",
    USDCAD: "USDCAD=X", NZDUSD: "NZDUSD=X",
    GOLD: "GC=F", SILVER: "SI=F", PLATINUM: "PL=F",
    "OIL.WTI": "CL=F", OIL: "BZ=F", NATGAS: "NG=F",
    BITCOIN: "BTC-USD", ETHEREUM: "ETH-USD", SOLANA: "SOL-USD", RIPPLE: "XRP-USD",
    CARDANO: "ADA-USD", POLKADOT: "DOT-USD", CHAINLINK: "LINK-USD", AVALANCHE: "AVAX-USD",
    LITECOIN: "LTC-USD", DOGECOIN: "DOGE-USD", POLYGON: "MATIC-USD", UNISWAP: "UNI7083-USD",
  };
  return map[ticker] || ticker;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { asset, ticker, direction, entry, stopLoss, takeProfit, leverage, confidence, reasoning, market, category } = body;

    if (!ticker || !entry) {
      return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
    }

    // 1. Aktuellen Kurs laden
    const yahooSymbol = getYahooSymbol(ticker);
    const currentPrice = await fetchCurrentPrice(ticker, yahooSymbol);

    if (!currentPrice) {
      return NextResponse.json({ error: "Aktueller Kurs konnte nicht geladen werden" }, { status: 502 });
    }

    // 2. Kursabweichung berechnen
    const priceDiffPercent = ((currentPrice - entry) / entry) * 100;

    // 3. Claude Re-Check
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `Du bist ein CFD-Daytrading-Analyst. Ein Signal wurde heute morgen generiert. Der Trader will jetzt die Position eröffnen. Prüfe ob der Trade bei aktuellem Kurs noch sinnvoll ist und passe die Werte an.

Antworte ausschließlich mit JSON, kein anderer Text.`,
      messages: [
        {
          role: "user",
          content: `Original-Signal:
- Asset: ${asset} (${ticker})
- Richtung: ${direction}
- Kategorie: ${category} | Markt: ${market}
- Entry: ${entry}
- Stop-Loss: ${stopLoss}
- Take-Profit: ${takeProfit}
- Hebel: ${leverage}
- Konfidenz: ${confidence}%
- Begründung: ${reasoning}

Aktueller Kurs: ${currentPrice} (${priceDiffPercent > 0 ? "+" : ""}${priceDiffPercent.toFixed(2)}% seit Signal)

Prüfe:
1. Ist der Trade bei aktuellem Kurs noch valide?
2. Passe Entry auf den aktuellen Kurs an
3. Passe SL und TP proportional an (gleicher Abstand)
4. Aktualisiere die Konfidenz basierend auf der Kursentwicklung

Antworte NUR mit diesem JSON:
{
  "valid": true/false,
  "entry": aktueller_entry,
  "stopLoss": angepasster_sl,
  "takeProfit": angepasstes_tp,
  "confidence": aktualisierte_konfidenz,
  "reason": "Kurze Begründung auf Deutsch warum valide/invalide"
}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Keine Antwort von Claude");
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Kein JSON in Antwort");

    const result = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      currentPrice,
      priceDiffPercent: Math.round(priceDiffPercent * 100) / 100,
      valid: result.valid,
      entry: result.entry,
      stopLoss: result.stopLoss,
      takeProfit: result.takeProfit,
      confidence: result.confidence,
      reason: result.reason,
    });
  } catch (err) {
    console.error("Revalidierung fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
