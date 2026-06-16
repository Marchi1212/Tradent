import { NextResponse } from "next/server";
import { getScanCandidates, saveScanCandidates, scanCandidatesExist } from "@/lib/signal-store";
import { generatePreAnalysis } from "@/lib/signal-generator";
import { getTradingDayType } from "@/lib/market-hours";

export const maxDuration = 60;

export async function GET() {
  try {
    // 1. Scan nur an Wochentagen (WE/Feiertage haben Single-Generierung)
    const now = new Date();
    const cetStr = now.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
    const cet = new Date(cetStr);
    const dayType = getTradingDayType(cet);

    if (dayType !== "weekday") {
      return NextResponse.json({ skip: true, reason: "Scan nur an Wochentagen" });
    }

    // 2. Schon generiert?
    const existing = await getScanCandidates();
    if (existing) {
      return NextResponse.json({ candidates: existing });
    }

    // 3. Mindest-Zeit: 09:15
    const currentMinutes = cet.getHours() * 60 + cet.getMinutes();
    if (currentMinutes < 9 * 60 + 15) {
      return NextResponse.json({ waitUntil: "09:15" });
    }

    // 4. Race-Condition Check
    const exists = await scanCandidatesExist();
    if (exists) {
      const candidates = await getScanCandidates();
      return NextResponse.json({ candidates });
    }

    // 5. Pre-Analysis generieren
    console.log("Scan: Generiere Pre-Analysis...");
    const candidates = await generatePreAnalysis();
    await saveScanCandidates(candidates);

    return NextResponse.json({ candidates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("Scan fehlgeschlagen:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
