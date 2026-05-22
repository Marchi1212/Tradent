import { NextResponse } from "next/server";

// Yahoo-Symbol Mapping (gleich wie in revalidate)
const YAHOO_MAP: Record<string, string> = {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "ticker Parameter fehlt" }, { status: 400 });
  }

  const yahooSymbol = YAHOO_MAP[ticker] || ticker;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tradent/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Yahoo Finance nicht erreichbar" }, { status: 502 });
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
