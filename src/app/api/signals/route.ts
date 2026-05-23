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

    // 2. Mindest-Zeitpunkt prüfen (Performance: Markt muss erst anlaufen)
    const now = new Date();
    const cetStr = now.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
    const cet = new Date(cetStr);
    const currentMinutes = cet.getHours() * 60 + cet.getMinutes();
    const day = cet.getDay();
    const isWeekendDay = day === 0 || day === 6;
    const minMinutes = isWeekendDay ? 8 * 60 : 9 * 60 + 15; // WE: 08:00, Werktag: 09:15

    if (currentMinutes < minMinutes) {
      const waitUntil = isWeekendDay ? "08:00" : "09:15";
      return NextResponse.json({ waitUntil, isWeekend: isWeekendDay });
    }

    // 3. Noch keine Signale → generieren
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
