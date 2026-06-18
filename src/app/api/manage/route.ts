import { NextResponse } from "next/server";
import { WATCHLIST } from "@/lib/market-data";

export const maxDuration = 30;

// XTB-Ticker → Yahoo-Symbol Mapping aus der Watchlist
const tickerToSymbol = new Map<string, string>();
for (const w of WATCHLIST) {
  tickerToSymbol.set(w.ticker, w.symbol);
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Nur zwischen 10:00 und 22:30 CET aktiv
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

    // Signal-Ticker holen und in Yahoo-Symbole umwandeln
    const signalIds = [...new Set(openTrades.map(t => t.signal_id))];
    const { data: signals } = await supabase
      .from("signals")
      .select("id, ticker")
      .in("id", signalIds);

    const signalToYahoo = new Map<string, string>();
    for (const s of (signals || [])) {
      const xbtTicker = s.ticker as string;
      const yahooSymbol = tickerToSymbol.get(xbtTicker) || xbtTicker;
      signalToYahoo.set(s.id as string, yahooSymbol);
    }

    // Kurse von Yahoo holen (mit Yahoo-Symbol, nicht XTB-Ticker)
    const yahooSymbols = [...new Set([...signalToYahoo.values()])];
    const priceMap = new Map<string, number>();

    for (const symbol of yahooSymbols) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
          {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (res.ok) {
          const json = await res.json();
          const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (price) priceMap.set(symbol, price);
        }
      } catch {
        // Preis nicht verfügbar — skip
      }
    }

    let notified = 0;
    for (const trade of openTrades) {
      const yahooSymbol = signalToYahoo.get(trade.signal_id);
      if (!yahooSymbol) continue;
      const currentPrice = priceMap.get(yahooSymbol);
      if (!currentPrice) continue;

      const slDistance = Math.abs(trade.entry - trade.stop_loss);
      const isLong = trade.direction === "LONG";
      const priceDiff = isLong
        ? currentPrice - trade.entry
        : trade.entry - currentPrice;
      const profitPercent = ((priceDiff / trade.entry) * 100).toFixed(1);
      const tpDistance = Math.abs(trade.take_profit - trade.entry);
      const progressToTp = tpDistance > 0 ? priceDiff / tpDistance : 0;

      // Wie weit zum Stop-Loss? (negativ = Richtung SL)
      const progressToSl = slDistance > 0 ? -priceDiff / slDistance : 0;

      let title: string | null = null;
      let body: string | null = null;

      if (isCloseTime) {
        const prefix = priceDiff >= 0 ? `+${profitPercent}%` : `${profitPercent}%`;
        title = `${trade.asset}: Jetzt schließen (${prefix})`;
        body = "Feierabend — Trade jetzt schließen. Kein Overnight-Risiko.";
      } else if (progressToTp >= 0.8) {
        title = `${trade.asset}: Jetzt schließen (+${profitPercent}%)`;
        body = "Fast am Take-Profit — Gewinn jetzt mitnehmen.";
      } else if (priceDiff >= slDistance) {
        title = `${trade.asset}: Stoploss anpassen (+${profitPercent}%)`;
        body = "Trade im Plus — öffne die App für Details.";
      } else if (progressToSl >= 0.75) {
        title = `${trade.asset}: Achtung (${profitPercent}%)`;
        body = "75% zum Stop-Loss — Position prüfen, ggf. manuell schließen.";
      } else if (progressToSl >= 0.5) {
        title = `${trade.asset}: Im Minus (${profitPercent}%)`;
        body = "Trade läuft gegen dich — beobachten oder Position reduzieren.";
      }

      if (title && body) {
        const signalKey = isCloseTime
          ? `close-${trade.id}`
          : `manage-${trade.id}-${progressToSl >= 0.75 ? "warn75" : progressToSl >= 0.5 ? "warn50" : "profit"}`;
        await supabase.from("push_queue").upsert(
          {
            user_id: trade.user_id,
            signal_id: signalKey,
            title,
            body,
            fire_at: new Date().toISOString(),
            sent: false,
          },
          { onConflict: "user_id,signal_id", ignoreDuplicates: true }
        );
        notified++;
      }
    }

    return NextResponse.json({ checked: openTrades.length, notified, prices: yahooSymbols.length });
  } catch (err) {
    console.error("Manage-Check fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
