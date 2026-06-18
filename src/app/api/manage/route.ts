import { NextResponse } from "next/server";
import { WATCHLIST, fetchAssetByTicker, analyzeAsset } from "@/lib/market-data";
import type { AssetMarketData } from "@/lib/market-data";

export const maxDuration = 30;

const tickerToSymbol = new Map<string, string>();
for (const w of WATCHLIST) {
  tickerToSymbol.set(w.ticker, w.symbol);
}

type ManageDecision = "HALTEN" | "SCHLIESSEN" | "SL_NACHZIEHEN" | "GEWINN_MITNEHMEN" | "FEIERABEND";

interface TradeCheck {
  asset: string;
  decision: ManageDecision;
  reason: string;
  profitPercent: string;
}

function evaluateTrade(
  trade: { asset: string; direction: string; entry: number; stop_loss: number; take_profit: number },
  marketData: AssetMarketData,
  isCloseTime: boolean
): TradeCheck {
  const isLong = trade.direction === "LONG";
  const currentPrice = marketData.currentPrice;
  const slDistance = Math.abs(trade.entry - trade.stop_loss);
  const tpDistance = Math.abs(trade.take_profit - trade.entry);
  const priceDiff = isLong ? currentPrice - trade.entry : trade.entry - currentPrice;
  const profitPercent = ((priceDiff / trade.entry) * 100).toFixed(1);
  const progressToSl = slDistance > 0 ? -priceDiff / slDistance : 0;
  const progressToTp = tpDistance > 0 ? priceDiff / tpDistance : 0;

  // 22:00+: immer schließen
  if (isCloseTime) {
    const prefix = priceDiff >= 0 ? `+${profitPercent}%` : `${profitPercent}%`;
    return { asset: trade.asset, decision: "FEIERABEND", reason: `${prefix} — Feierabend, kein Overnight-Risiko.`, profitPercent };
  }

  // Im Plus: Standard-Logik
  if (priceDiff > 0) {
    if (progressToTp >= 0.8) {
      return { asset: trade.asset, decision: "GEWINN_MITNEHMEN", reason: `+${profitPercent}% — fast am Take-Profit. Gewinn jetzt sichern.`, profitPercent };
    }
    if (priceDiff >= slDistance) {
      return { asset: trade.asset, decision: "SL_NACHZIEHEN", reason: `+${profitPercent}% — Stop-Loss auf Einstand nachziehen.`, profitPercent };
    }
    return { asset: trade.asset, decision: "HALTEN", reason: `+${profitPercent}% — Trade läuft planmäßig.`, profitPercent };
  }

  // Notbremse: ≥85% zum SL → sofort raus
  if (progressToSl >= 0.85) {
    return { asset: trade.asset, decision: "SCHLIESSEN", reason: `${profitPercent}% — fast am Stop-Loss. Jetzt schließen, Rest-Verlust sparen.`, profitPercent };
  }

  // Im Minus: These neu prüfen mit aktuellen Indikatoren
  const analysis = analyzeAsset(marketData);
  const thesisIntact = analysis.direction === trade.direction && !analysis.filtered;

  // These gebrochen: Indikatoren zeigen nicht mehr in unsere Richtung
  if (!thesisIntact) {
    const reasons: string[] = [];
    if (analysis.filtered) {
      reasons.push(analysis.filterReason || "Signal-Kriterien nicht mehr erfüllt");
    } else if (analysis.direction !== trade.direction) {
      reasons.push(`Indikatoren zeigen jetzt ${analysis.direction || "neutral"} statt ${trade.direction}`);
    }
    if (marketData.rsi14 !== null) reasons.push(`RSI ${marketData.rsi14}`);

    return {
      asset: trade.asset,
      decision: "SCHLIESSEN",
      reason: `${profitPercent}% — These gebrochen: ${reasons.join(", ")}. Jetzt schließen.`,
      profitPercent,
    };
  }

  // These intakt aber deutlich im Minus → halten mit Begründung
  const holdReasons: string[] = [];
  if (marketData.rsi14 !== null) holdReasons.push(`RSI ${marketData.rsi14}`);
  if (analysis.confidence >= 60) holdReasons.push(`Konfidenz ${analysis.confidence}%`);
  if (marketData.support !== null && isLong && currentPrice > marketData.support) {
    holdReasons.push(`Support ${marketData.support} hält`);
  }
  if (marketData.resistance !== null && !isLong && currentPrice < marketData.resistance) {
    holdReasons.push(`Resistance ${marketData.resistance} hält`);
  }

  return {
    asset: trade.asset,
    decision: "HALTEN",
    reason: `${profitPercent}% — These intakt: ${holdReasons.join(", ")}. Halten.`,
    profitPercent,
  };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cetNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
    const cetMinutes = cetNow.getHours() * 60 + cetNow.getMinutes();
    if (cetMinutes < 600 || cetMinutes > 1350) {
      return NextResponse.json({ skip: true, reason: "Außerhalb 10:00-22:30" });
    }

    const isCloseTime = cetNow.getHours() >= 22;

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: openTrades, error: tradesError } = await supabase
      .from("trades")
      .select("id, user_id, asset, direction, entry, stop_loss, take_profit, signal_id")
      .eq("status", "open");

    if (tradesError || !openTrades || openTrades.length === 0) {
      return NextResponse.json({ checked: 0 });
    }

    // Signal-Ticker holen
    const signalIds = [...new Set(openTrades.map(t => t.signal_id))];
    const { data: signals } = await supabase
      .from("signals")
      .select("id, ticker")
      .in("id", signalIds);

    const signalToTicker = new Map<string, string>();
    for (const s of (signals || [])) {
      signalToTicker.set(s.id as string, s.ticker as string);
    }

    // Volle Marktdaten pro Asset laden (RSI, MACD, BB, Support/Resistance)
    const tickersNeeded = [...new Set([...signalToTicker.values()])];
    const marketDataMap = new Map<string, AssetMarketData>();

    for (const ticker of tickersNeeded) {
      try {
        const data = await fetchAssetByTicker(ticker);
        if (data) marketDataMap.set(ticker, data);
      } catch {
        // Skip
      }
    }

    let notified = 0;
    const results: TradeCheck[] = [];

    for (const trade of openTrades) {
      const ticker = signalToTicker.get(trade.signal_id);
      if (!ticker) continue;
      const marketData = marketDataMap.get(ticker);
      if (!marketData) continue;

      const check = evaluateTrade(trade, marketData, isCloseTime);
      results.push(check);

      // Nur Push bei Handlungsbedarf
      if (check.decision === "HALTEN") continue;

      const titleMap: Record<ManageDecision, string> = {
        SCHLIESSEN: `${trade.asset}: Jetzt schließen`,
        FEIERABEND: `${trade.asset}: Jetzt schließen`,
        GEWINN_MITNEHMEN: `${trade.asset}: Gewinn mitnehmen`,
        SL_NACHZIEHEN: `${trade.asset}: SL nachziehen`,
        HALTEN: "",
      };

      const signalKey = `manage-${trade.id}-${check.decision.toLowerCase()}`;
      await supabase.from("push_queue").upsert(
        {
          user_id: trade.user_id,
          signal_id: signalKey,
          title: titleMap[check.decision],
          body: check.reason,
          fire_at: new Date().toISOString(),
          sent: false,
        },
        { onConflict: "user_id,signal_id", ignoreDuplicates: true }
      );
      notified++;
    }

    return NextResponse.json({ checked: openTrades.length, notified, results });
  } catch (err) {
    console.error("Manage-Check fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
