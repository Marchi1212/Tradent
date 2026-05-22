import { NextResponse } from "next/server";
import { getTodaySignalsServer, saveTodaySignals, todaySignalsExist } from "@/lib/signal-store";
import { generateSignals } from "@/lib/signal-generator";

export const maxDuration = 60; // Vercel: max 60s für Signalgenerierung

export async function GET() {
  try {
    // 1. Prüfen ob heute schon Signale existieren
    const existing = await getTodaySignalsServer();
    if (existing) {
      return NextResponse.json(existing);
    }

    // 2. Noch keine Signale → generieren
    console.log("Keine Signale für heute gefunden. Generiere...");

    // Double-Check um Race Conditions zu vermeiden
    const exists = await todaySignalsExist();
    if (exists) {
      const signals = await getTodaySignalsServer();
      return NextResponse.json(signals);
    }

    // 3. Claude API aufrufen + Marktdaten laden
    const generated = await generateSignals();

    // 4. In Supabase speichern
    await saveTodaySignals(generated);

    // 5. Gespeicherte Signale zurückgeben (mit IDs)
    const saved = await getTodaySignalsServer();
    return NextResponse.json(saved);
  } catch (err) {
    console.error("Signal-Generierung fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
