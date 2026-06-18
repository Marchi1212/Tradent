import { NextResponse } from "next/server";
import { WATCHLIST } from "@/lib/market-data";

export const maxDuration = 15;

const tickerToSymbol = new Map<string, string>();
for (const w of WATCHLIST) {
  tickerToSymbol.set(w.ticker, w.symbol);
}

async function fetchCurrentPrice(yahooSymbol: string): Promise<number | null> {
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

// Rein mathematische Revalidierung – kein Claude-Call nötig
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, direction, entry, stopLoss, takeProfit, confidence } = body;

    if (!ticker || !entry) {
      return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
    }

    // 1. Aktuellen Kurs laden (kostenlos via Yahoo Finance)
    const yahooSymbol = tickerToSymbol.get(ticker) || ticker;
    const currentPrice = await fetchCurrentPrice(yahooSymbol);

    if (!currentPrice) {
      return NextResponse.json({ error: "Aktueller Kurs konnte nicht geladen werden" }, { status: 502 });
    }

    // 2. Kursabweichung berechnen
    const priceDiffPercent = ((currentPrice - entry) / entry) * 100;
    const absDiff = Math.abs(priceDiffPercent);

    // 3. SL/TP-Abstände berechnen
    const slDistance = Math.abs(entry - stopLoss);
    const tpDistance = Math.abs(takeProfit - entry);

    // 4. Validität prüfen
    let valid = true;
    let reason = "";
    let adjustedConfidence = confidence;

    if (direction === "LONG") {
      // Kurs bereits am oder über TP → zu spät
      if (currentPrice >= takeProfit) {
        valid = false;
        reason = "Kurs hat Take-Profit bereits erreicht. Trade nicht mehr sinnvoll.";
      }
      // Kurs bereits am oder unter SL → falscher Einstieg
      else if (currentPrice <= stopLoss) {
        valid = false;
        reason = "Kurs ist unter den Stop-Loss gefallen. Signal ungültig.";
      }
      // Kurs stark gestiegen → Risk/Reward verschlechtert
      else if (currentPrice > entry + tpDistance * 0.6) {
        valid = false;
        reason = `Kurs ist ${absDiff.toFixed(1)}% gestiegen. Verbleibendes Potenzial zu gering.`;
      }
      // Kurs leicht gestiegen → etwas weniger Konfidenz
      else if (currentPrice > entry) {
        adjustedConfidence = Math.max(50, confidence - Math.round(absDiff * 3));
        reason = `Kurs ${absDiff.toFixed(1)}% über Signal-Entry. Levels proportional angepasst.`;
      }
      // Kurs leicht gefallen → etwas mehr Konfidenz (besserer Einstieg)
      else if (currentPrice < entry) {
        adjustedConfidence = Math.min(95, confidence + Math.round(absDiff * 2));
        reason = `Kurs ${absDiff.toFixed(1)}% unter Signal-Entry. Besserer Einstieg möglich.`;
      }
      // Kurs nahezu unverändert
      else {
        reason = "Kurs nahezu unverändert. Trade bestätigt.";
      }
    } else {
      // SHORT
      if (currentPrice <= takeProfit) {
        valid = false;
        reason = "Kurs hat Take-Profit bereits erreicht. Trade nicht mehr sinnvoll.";
      } else if (currentPrice >= stopLoss) {
        valid = false;
        reason = "Kurs ist über den Stop-Loss gestiegen. Signal ungültig.";
      } else if (currentPrice < entry - tpDistance * 0.6) {
        valid = false;
        reason = `Kurs ist ${absDiff.toFixed(1)}% gefallen. Verbleibendes Potenzial zu gering.`;
      } else if (currentPrice < entry) {
        adjustedConfidence = Math.max(50, confidence - Math.round(absDiff * 3));
        reason = `Kurs ${absDiff.toFixed(1)}% unter Signal-Entry. Levels proportional angepasst.`;
      } else if (currentPrice > entry) {
        adjustedConfidence = Math.min(95, confidence + Math.round(absDiff * 2));
        reason = `Kurs ${absDiff.toFixed(1)}% über Signal-Entry. Besserer Short-Einstieg möglich.`;
      } else {
        reason = "Kurs nahezu unverändert. Trade bestätigt.";
      }
    }

    // 5. Neue Levels berechnen (Entry auf aktuellen Kurs, SL/TP proportional verschieben)
    const shift = currentPrice - entry;
    const newEntry = currentPrice;
    const newStopLoss = Math.round((stopLoss + shift) * 10000) / 10000;
    const newTakeProfit = Math.round((takeProfit + shift) * 10000) / 10000;

    return NextResponse.json({
      currentPrice,
      priceDiffPercent: Math.round(priceDiffPercent * 100) / 100,
      valid,
      entry: newEntry,
      stopLoss: newStopLoss,
      takeProfit: newTakeProfit,
      confidence: adjustedConfidence,
      reason,
    });
  } catch (err) {
    console.error("Revalidierung fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
