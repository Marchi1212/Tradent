import { NextResponse } from "next/server";
import { WATCHLIST } from "@/lib/market-data";

const tickerToSymbol = new Map<string, string>();
for (const w of WATCHLIST) {
  tickerToSymbol.set(w.ticker, w.symbol);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "ticker Parameter fehlt" }, { status: 400 });
  }

  const yahooSymbol = tickerToSymbol.get(ticker) || ticker;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: "Yahoo Finance nicht erreichbar", debug: { status: res.status, yahooSymbol, url, body: text.slice(0, 200) } }, { status: 502 });
    }

    const json = await res.json();
    const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter((c: number | null) => c != null);

    if (validCloses.length === 0) {
      return NextResponse.json({ error: "Kein Kurs verfügbar" }, { status: 404 });
    }

    const currentPrice = validCloses[validCloses.length - 1];

    return NextResponse.json({ price: currentPrice });
  } catch {
    return NextResponse.json({ error: "Kurs konnte nicht geladen werden" }, { status: 500 });
  }
}
