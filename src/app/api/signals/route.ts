import { NextResponse } from "next/server";
import { getSessionSignals, saveSessionSignals, sessionSignalsExist } from "@/lib/signal-store";
import { generateSignals } from "@/lib/signal-generator";
import { getRelevantSession, getCurrentSessionStatus } from "@/lib/sessions";

export const maxDuration = 60;

export async function GET() {
  try {
    // 1. Welche Session ist gerade relevant?
    const sessionStatus = getCurrentSessionStatus();
    const sessionId = getRelevantSession();

    // Keine Session aktiv (vor 8:30)
    if (!sessionId) {
      return NextResponse.json({
        status: sessionStatus.type,
        session: sessionStatus.type === "upcoming" ? sessionStatus.session : null,
        minutesUntil: sessionStatus.type === "upcoming" ? sessionStatus.minutesUntil : null,
        signals: null,
      });
    }

    // 2. Prüfen ob Signale für diese Session schon existieren
    const existing = await getSessionSignals(sessionId);
    if (existing) {
      return NextResponse.json({
        status: sessionStatus.type,
        session: sessionStatus.type !== "closed" ? sessionStatus.session : null,
        minutesLeft: sessionStatus.type === "active" ? sessionStatus.minutesLeft : null,
        minutesUntil: sessionStatus.type === "upcoming" ? sessionStatus.minutesUntil : null,
        signals: existing,
      });
    }

    // 3. Noch keine Signale → generieren
    console.log(`Keine Signale für Session ${sessionId}. Generiere...`);

    // Double-Check gegen Race Conditions
    const exists = await sessionSignalsExist(sessionId);
    if (exists) {
      const signals = await getSessionSignals(sessionId);
      return NextResponse.json({
        status: sessionStatus.type,
        session: sessionStatus.type !== "closed" ? sessionStatus.session : null,
        signals,
      });
    }

    // 4. Claude API + Marktdaten
    const generated = await generateSignals(sessionId);

    // 5. Speichern
    await saveSessionSignals(sessionId, generated);

    // 6. Gespeicherte Signale zurückgeben
    const saved = await getSessionSignals(sessionId);
    return NextResponse.json({
      status: sessionStatus.type,
      session: sessionStatus.type !== "closed" ? sessionStatus.session : null,
      signals: saved,
    });
  } catch (err) {
    console.error("Signal-Generierung fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
