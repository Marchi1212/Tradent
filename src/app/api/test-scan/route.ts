import { NextResponse } from "next/server";
import { generatePreAnalysis } from "@/lib/signal-generator";

export const maxDuration = 60;

// Temporärer Test-Endpoint — nach Test löschen
export async function GET() {
  try {
    const candidates = await generatePreAnalysis();
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("Test-Scan fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
