import { NextResponse } from "next/server";
import { getTodaySignals, saveTodaySignals, todaySignalsExist } from "@/lib/signal-store";
import { generateSignals } from "@/lib/signal-generator";

export const maxDuration = 60;

export async function GET() {
  try {
    // 1. Prüfen ob heute schon Signale existieren
    const existing = await getTodaySignals();
    if (existing) {
      return NextResponse.json({ signals: existing });
    }

    // 2. Noch keine Signale → generieren
    console.log("Keine Signale für heute. Generiere aus 47 Assets...");

    // Double-Check gegen Race Conditions
    const exists = await todaySignalsExist();
    if (exists) {
      const signals = await getTodaySignals();
      return NextResponse.json({ signals });
    }

    // 3. Claude API + Marktdaten (alle 47 Assets)
    const generated = await generateSignals();

    // 4. Speichern
    await saveTodaySignals(generated);

    // 5. Gespeicherte Signale zurückgeben
    const saved = await getTodaySignals();
    return NextResponse.json({ signals: saved });
  } catch (err) {
    console.error("Signal-Generierung fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
