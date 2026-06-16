import { NextResponse } from "next/server";
import { getScanCandidates } from "@/lib/signal-store";
import { generatePreAnalysis } from "@/lib/signal-generator";

export const maxDuration = 60;

export async function GET() {
  try {
    const oldCandidates = await getScanCandidates();

    console.log("Compare: Generiere frische Analyse mit neuen Indikatoren...");
    const newCandidates = await generatePreAnalysis();

    return NextResponse.json({
      old: oldCandidates,
      new: newCandidates,
      oldCount: oldCandidates?.length ?? 0,
      newCount: newCandidates.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("Compare fehlgeschlagen:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
