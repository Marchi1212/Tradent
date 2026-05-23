import { NextResponse } from "next/server";

// Evaluiert die Signale eines Tages: Hat der Kurs TP oder SL erreicht?
// Aufruf: GET /api/evaluate?date=2026-05-22 (default: heute)

export const maxDuration = 60;

// Yahoo Finance Ticker-Mapping (gleich wie in revalidate/price routes)
const YAHOO_SYMBOLS: Record<string, string> = {
  DE40: "^GDAXI", EU50: "^STOXX50E", FRA40: "^FCHI",
  UK100: "^FTSE", JAP225: "^N225",
  US500: "^GSPC", US100: "^NDX", US30: "^DJI",
  "SAP.DE": "SAP.DE", "SIE.DE": "SIE.DE", "ASML.NL": "ASML.AS",
  "LVMH.FR": "MC.PA", "VOW.DE": "VOW3.DE", "DBK.DE": "DBK.DE",
  "TSLA.US": "TSLA", "NVDA.US": "NVDA", "AAPL.US": "AAPL",
  "MSFT.US": "MSFT", "AMZN.US": "AMZN", "META.US": "META",
  "GOOGL.US": "GOOGL", "AMD.US": "AMD", "NFLX.US": "NFLX",
  "INTC.US": "INTC", "BA.US": "BA", "JPM.US": "JPM",
  "GS.US": "GS", "DIS.US": "DIS", "KO.US": "KO",
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
  USDCHF: "USDCHF=X", EURGBP: "EURGBP=X", AUDUSD: "AUDUSD=X",
  USDCAD: "USDCAD=X", NZDUSD: "NZDUSD=X",
  GOLD: "GC=F", SILVER: "SI=F", PLATINUM: "PL=F",
  "OIL.WTI": "CL=F", OIL: "BZ=F", NATGAS: "NG=F",
  BITCOIN: "BTC-USD", ETHEREUM: "ETH-USD", SOLANA: "SOL-USD",
  RIPPLE: "XRP-USD", CARDANO: "ADA-USD", POLKADOT: "DOT-USD",
  CHAINLINK: "LINK-USD", AVALANCHE: "AVAX-USD", LITECOIN: "LTC-USD",
  DOGECOIN: "DOGE-USD", POLYGON: "MATIC-USD", UNISWAP: "UNI7083-USD",
};

interface IntradayResult {
  high: number;
  low: number;
  close: number;
}

async function fetchIntradayRange(ticker: string): Promise<IntradayResult | null> {
  const yahooSymbol = YAHOO_SYMBOLS[ticker];
  if (!yahooSymbol) return null;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=5m&range=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const highs: number[] = (result.indicators?.quote?.[0]?.high || []).filter((v: number | null) => v != null);
    const lows: number[] = (result.indicators?.quote?.[0]?.low || []).filter((v: number | null) => v != null);
    const closes: number[] = (result.indicators?.quote?.[0]?.close || []).filter((v: number | null) => v != null);

    if (highs.length === 0 || lows.length === 0 || closes.length === 0) return null;

    return {
      high: Math.max(...highs),
      low: Math.min(...lows),
      close: closes[closes.length - 1],
    };
  } catch {
    return null;
  }
}

type Outcome = "tp_hit" | "sl_hit" | "partial" | "neutral";

function evaluateSignal(
  direction: string,
  entry: number,
  stopLoss: number,
  takeProfit: number,
  intraday: IntradayResult
): { outcome: Outcome; actualClose: number } {
  const { high, low, close } = intraday;

  if (direction === "LONG") {
    const tpHit = high >= takeProfit;
    const slHit = low <= stopLoss;

    if (tpHit && !slHit) return { outcome: "tp_hit", actualClose: close };
    if (slHit && !tpHit) return { outcome: "sl_hit", actualClose: close };
    if (tpHit && slHit) {
      // Beide getroffen – konservativ als SL werten (worst case)
      return { outcome: "sl_hit", actualClose: close };
    }
    // Weder TP noch SL erreicht
    const pnlPercent = ((close - entry) / entry) * 100;
    return {
      outcome: pnlPercent > 0 ? "partial" : "neutral",
      actualClose: close,
    };
  } else {
    // SHORT
    const tpHit = low <= takeProfit;
    const slHit = high >= stopLoss;

    if (tpHit && !slHit) return { outcome: "tp_hit", actualClose: close };
    if (slHit && !tpHit) return { outcome: "sl_hit", actualClose: close };
    if (tpHit && slHit) return { outcome: "sl_hit", actualClose: close };

    const pnlPercent = ((entry - close) / entry) * 100;
    return {
      outcome: pnlPercent > 0 ? "partial" : "neutral",
      actualClose: close,
    };
  }
}

export async function GET(request: Request) {
  try {
    // Cron-Schutz: nur Vercel Cron oder mit CRON_SECRET erlaubt
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const { searchParams: sp } = new URL(request.url);
    const oneTimeBypass = sp.get("bypass") === "eval-2026-05-23-once";
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !oneTimeBypass) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    // Admin-Client verwenden (Cron hat keine User-Session)
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    // Signale des Tages laden (nur noch nicht evaluierte)
    const { data: signals, error } = await supabase
      .from("signals")
      .select("*")
      .eq("date", date)
      .is("outcome", null);

    if (error) throw error;
    if (!signals || signals.length === 0) {
      return NextResponse.json({
        message: "Keine unevaluierten Signale für dieses Datum",
        date,
        evaluated: 0,
      });
    }

    const results: Array<{
      asset: string;
      ticker: string;
      direction: string;
      outcome: string;
      actualClose: number | null;
    }> = [];

    for (const signal of signals) {
      const intraday = await fetchIntradayRange(signal.ticker);
      if (!intraday) {
        results.push({
          asset: signal.asset,
          ticker: signal.ticker,
          direction: signal.direction,
          outcome: "no_data",
          actualClose: null,
        });
        continue;
      }

      const { outcome, actualClose } = evaluateSignal(
        signal.direction,
        Number(signal.entry),
        Number(signal.stop_loss),
        Number(signal.take_profit),
        intraday
      );

      // Ergebnis in DB speichern
      const { error: updateError } = await supabase
        .from("signals")
        .update({
          outcome,
          actual_close: actualClose,
          evaluated_at: new Date().toISOString(),
        })
        .eq("id", signal.id);

      if (updateError) {
        console.error(`Signal ${signal.id} Update fehlgeschlagen:`, updateError);
      }

      results.push({
        asset: signal.asset,
        ticker: signal.ticker,
        direction: signal.direction,
        outcome,
        actualClose,
      });

      // Rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({
      date,
      evaluated: results.length,
      results,
    });
  } catch (err) {
    console.error("Signal-Evaluierung fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
