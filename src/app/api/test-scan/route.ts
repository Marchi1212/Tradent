import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchMarketDataForSession, type AssetMarketData } from "@/lib/market-data";
import { fetchMarketContext, formatMarketContextForPrompt, fetchNewsContext } from "@/lib/market-context";
import { getExchangeNotes } from "@/lib/market-hours";

export const maxDuration = 60;

function formatMarketDataForPrompt(data: AssetMarketData[]): string {
  return data
    .map(
      (d) =>
        `${d.name} (${d.ticker}) | ${d.category} | ${d.market}
  Kurs: ${d.currentPrice} | 1T: ${d.change1dPercent > 0 ? "+" : ""}${d.change1dPercent}% | 5T: ${d.change5dPercent > 0 ? "+" : ""}${d.change5dPercent}%
  5T-Hoch: ${d.high5d} | 5T-Tief: ${d.low5d} | SMA20: ${d.sma20 ?? "n/a"} | RSI14: ${d.rsi14 ?? "n/a"}
  ATR14: ${d.atr14 ?? "n/a"} (${d.atr14Percent != null ? d.atr14Percent + "%" : "n/a"} vom Kurs)`
    )
    .join("\n\n");
}

export async function GET() {
  try {
    const [marketData, marketContext, newsContext] = await Promise.all([
      fetchMarketDataForSession("eu"),
      fetchMarketContext(),
      fetchNewsContext(),
    ]);

    const formattedData = formatMarketDataForPrompt(marketData.slice(0, 20));
    const formattedContext = formatMarketContextForPrompt(marketContext);
    const exchangeNotes = getExchangeNotes();
    const newsBlock = newsContext?.raw
      ? `\nLIVE-NEWS (letzte 12h) — NEWS hat VETO-Recht:\n${newsContext.raw}\n`
      : "";

    const today = new Date().toLocaleDateString("de-DE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `Du bist ein regelbasierter CFD-Daytrading-Analyst. Erstelle eine SHORTLIST von 4-6 Kandidaten.
Antworte NUR mit validem JSON — kein Markdown, keine Code-Blöcke, kein Text davor oder danach.
Format: {"candidates":[{"asset":"Name","ticker":"XTB-Ticker","category":"Index","market":"XETRA","direction":"LONG","confidence":72,"note":"Kurze Begründung"}]}`,
      messages: [{
        role: "user",
        content: `Datum: ${today}\n${formattedContext}\n${newsBlock}\nMarktdaten:\n\n${formattedData}\n\nErstelle eine Shortlist von 4-6 Kandidaten. NUR valides JSON, kein anderer Text.`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "NO TEXT";

    let parsed = null;
    let parseError = null;
    try {
      let jsonText = rawText;
      const codeBlock = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) jsonText = codeBlock[1];
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Kein JSON gefunden");
      const cleaned = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(cleaned);
    } catch (err) {
      parseError = String(err);
    }

    return NextResponse.json({
      rawClaude: rawText,
      parsed,
      parseError,
      assetsLoaded: marketData.length,
      assetsSent: Math.min(20, marketData.length),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
