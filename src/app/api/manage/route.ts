import { NextResponse } from "next/server";

export const maxDuration = 30;

// Mid-Day Trade Management: Prüft offene Trades, queued Push wenn im Plus.
// Cron-Aufruf um ~16:00 CET via cron-job.org.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Nur zwischen 15:50 und 16:10 CET ausführen
    const cetNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
    const cetHour = cetNow.getHours();
    const cetMin = cetNow.getMinutes();
    if (!(cetHour === 15 && cetMin >= 50) && !(cetHour === 16 && cetMin < 10)) {
      return NextResponse.json({ skip: true, reason: "Außerhalb des Management-Fensters" });
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    // 1. Alle offenen Trades laden (mit Signal-Info für Ticker)
    const { data: openTrades, error: tradesError } = await supabase
      .from("trades")
      .select("id, user_id, asset, direction, entry, stop_loss, take_profit, signal_id")
      .eq("status", "open");

    if (tradesError || !openTrades || openTrades.length === 0) {
      return NextResponse.json({ checked: 0 });
    }

    // 2. Signal-Tickers laden
    const signalIds = [...new Set(openTrades.map(t => t.signal_id))];
    const { data: signals } = await supabase
      .from("signals")
      .select("id, ticker")
      .in("id", signalIds);

    const tickerMap = new Map<string, string>();
    for (const s of (signals || [])) {
      tickerMap.set(s.id as string, s.ticker as string);
    }

    // 3. Aktuelle Preise via Yahoo Finance holen
    const tickers = [...new Set(openTrades.map(t => tickerMap.get(t.signal_id)).filter(Boolean))] as string[];
    const priceMap = new Map<string, number>();

    for (const ticker of tickers) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
          {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (res.ok) {
          const json = await res.json();
          const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (price) priceMap.set(ticker, price);
        }
      } catch {
        // Preis nicht verfügbar — skip
      }
    }

    // 4. Für jeden Trade prüfen: im Plus ≥ 1x SL-Distanz?
    let notified = 0;
    for (const trade of openTrades) {
      const ticker = tickerMap.get(trade.signal_id);
      if (!ticker) continue;
      const currentPrice = priceMap.get(ticker);
      if (!currentPrice) continue;

      const slDistance = Math.abs(trade.entry - trade.stop_loss);
      const isLong = trade.direction === "LONG";
      const priceDiff = isLong
        ? currentPrice - trade.entry
        : trade.entry - currentPrice;

      // Mindestens 1x Risk im Plus?
      if (priceDiff >= slDistance) {
        const profitPercent = ((priceDiff / trade.entry) * 100).toFixed(1);
        const tpDistance = Math.abs(trade.take_profit - trade.entry);
        const progressToTp = tpDistance > 0 ? priceDiff / tpDistance : 0;

        let title: string;
        let body: string;
        if (progressToTp >= 0.8) {
          title = `${trade.asset}: Jetzt schließen (+${profitPercent}%)`;
          body = "Fast am Take-Profit — Trade jetzt schließen und Gewinn mitnehmen.";
        } else {
          title = `${trade.asset}: SL auf Einstand setzen (+${profitPercent}%)`;
          body = `Trade im Plus. SL auf ${trade.entry.toFixed(2)} setzen — dann ist der Trade risikofrei.`;
        }

        await supabase.from("push_queue").upsert(
          {
            user_id: trade.user_id,
            signal_id: `manage-${trade.id}`,
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

    return NextResponse.json({ checked: openTrades.length, notified });
  } catch (err) {
    console.error("Manage-Check fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
