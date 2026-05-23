import { NextResponse } from "next/server";

// Temporärer Endpoint: Rekonstruiert gelöschte Signale aus Trade-Daten
// Wird nach Benutzung wieder entfernt

// Asset-Name → Ticker Mapping (umgekehrt aus signal-generator)
const ASSET_TO_TICKER: Record<string, string> = {
  "DAX 40": "DE40", "Euro Stoxx 50": "EU50", "CAC 40": "FRA40",
  "FTSE 100": "UK100", "Nikkei 225": "JAP225",
  "S&P 500": "US500", "Nasdaq 100": "US100", "Dow Jones": "US30",
  "SAP": "SAP.DE", "Siemens": "SIE.DE", "ASML": "ASML.NL",
  "LVMH": "LVMH.FR", "Volkswagen": "VOW.DE", "Deutsche Bank": "DBK.DE",
  "Tesla": "TSLA.US", "NVIDIA": "NVDA.US", "Apple": "AAPL.US",
  "Microsoft": "MSFT.US", "Amazon": "AMZN.US", "Meta": "META.US",
  "Alphabet": "GOOGL.US", "AMD": "AMD.US", "Netflix": "NFLX.US",
  "Intel": "INTC.US", "Boeing": "BA.US", "JPMorgan": "JPM.US",
  "Goldman Sachs": "GS.US", "Disney": "DIS.US", "Coca-Cola": "KO.US",
  "EUR/USD": "EURUSD", "GBP/USD": "GBPUSD", "USD/JPY": "USDJPY",
  "USD/CHF": "USDCHF", "EUR/GBP": "EURGBP", "AUD/USD": "AUDUSD",
  "USD/CAD": "USDCAD", "NZD/USD": "NZDUSD",
  "Gold": "GOLD", "Silber": "SILVER", "Silver": "SILVER", "Platin": "PLATINUM",
  "WTI Öl": "OIL.WTI", "Brent Öl": "OIL", "Erdgas": "NATGAS",
  "Bitcoin": "BITCOIN", "Ethereum": "ETHEREUM", "Solana": "SOLANA",
  "Ripple": "RIPPLE", "Cardano": "CARDANO", "Polkadot": "POLKADOT",
  "Chainlink": "CHAINLINK", "Avalanche": "AVALANCHE", "Litecoin": "LITECOIN",
  "Dogecoin": "DOGECOIN", "Polygon": "POLYGON", "Uniswap": "UNISWAP",
};

function guessTicker(asset: string): string {
  // Exakter Match
  if (ASSET_TO_TICKER[asset]) return ASSET_TO_TICKER[asset];
  // Teilmatch
  for (const [name, ticker] of Object.entries(ASSET_TO_TICKER)) {
    if (asset.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(asset.toLowerCase())) {
      return ticker;
    }
  }
  return asset; // Fallback
}

function guessCategory(asset: string, ticker: string): string {
  if (ticker.includes(".DE") || ticker.includes(".NL") || ticker.includes(".FR")) return "EU-Aktien";
  if (ticker.includes(".US")) return "US-Aktien";
  if (["DE40","EU50","FRA40","UK100","JAP225","US500","US100","US30"].includes(ticker)) return "Indizes";
  if (["EURUSD","GBPUSD","USDJPY","USDCHF","EURGBP","AUDUSD","USDCAD","NZDUSD"].includes(ticker)) return "Forex";
  if (["GOLD","SILVER","PLATINUM","OIL.WTI","OIL","NATGAS"].includes(ticker)) return "Rohstoffe";
  if (["BITCOIN","ETHEREUM","SOLANA","RIPPLE","CARDANO","POLKADOT","CHAINLINK","AVALANCHE","LITECOIN","DOGECOIN","POLYGON","UNISWAP"].includes(ticker)) return "Krypto";
  return "Sonstige";
}

function guessMarket(category: string): string {
  if (category === "EU-Aktien" || category === "Indizes") return "XETRA";
  if (category === "US-Aktien") return "NYSE/NASDAQ";
  if (category === "Forex") return "Forex";
  if (category === "Rohstoffe") return "Commodities";
  if (category === "Krypto") return "Crypto";
  return "Unknown";
}

export async function GET() {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    // Trades vom 23. Mai laden
    const { data: trades, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .gte("opened_at", "2026-05-23T00:00:00")
      .lt("opened_at", "2026-05-24T00:00:00");

    if (tradeError) throw tradeError;
    if (!trades || trades.length === 0) {
      return NextResponse.json({ error: "Keine Trades vom 23. Mai gefunden", trades: [] });
    }

    const results = [];

    for (const trade of trades) {
      // Prüfen ob Signal schon existiert
      const { data: existing } = await supabase
        .from("signals")
        .select("id")
        .eq("id", trade.signal_id)
        .maybeSingle();

      if (existing) {
        results.push({ signal_id: trade.signal_id, asset: trade.asset, status: "already_exists" });
        continue;
      }

      const ticker = guessTicker(trade.asset);
      const leverage = parseFloat(trade.leverage) || 5;
      const category = guessCategory(trade.asset, ticker);
      const market = guessMarket(category);
      const riskClass = leverage <= 5 ? "steady" : "bold";

      const slPercent = trade.direction === "LONG"
        ? ((trade.entry - trade.stop_loss) / trade.entry) * 100
        : ((trade.stop_loss - trade.entry) / trade.entry) * 100;
      const tpPercent = trade.direction === "LONG"
        ? ((trade.take_profit - trade.entry) / trade.entry) * 100
        : ((trade.entry - trade.take_profit) / trade.entry) * 100;
      const rrRatio = tpPercent > 0 && slPercent > 0 ? (tpPercent / slPercent).toFixed(1) : "1.5";

      const { error: insertError } = await supabase
        .from("signals")
        .insert({
          id: trade.signal_id,
          date: "2026-05-23",
          risk_class: riskClass,
          asset: trade.asset,
          ticker,
          direction: trade.direction,
          leverage: trade.leverage,
          entry: trade.entry,
          stop_loss: trade.stop_loss,
          take_profit: trade.take_profit,
          confidence: riskClass === "steady" ? 78 : 62,
          expected_gain_percent: tpPercent * leverage,
          risk_reward_ratio: `1:${rrRatio}`,
          reasoning: "Signal-Daten rekonstruiert aus Trade-Historie (Original durch versehentliches Löschen verloren)",
          market,
          market_close_time: category === "Krypto" ? "21:00" : "17:30",
          optimal_entry: "09:00–11:00",
          category,
          outcome: null,
          created_at: trade.opened_at,
        });

      results.push({
        signal_id: trade.signal_id,
        asset: trade.asset,
        ticker,
        riskClass,
        status: insertError ? `error: ${insertError.message}` : "restored",
      });
    }

    return NextResponse.json({
      message: `${results.filter(r => r.status === "restored").length} Signale rekonstruiert`,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
