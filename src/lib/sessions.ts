// Trading-Sessions: EU (9:00–11:00) und US (15:30–17:30)
// Signale werden 30 Min vor Handelsfenster generiert

export type SessionId = "eu" | "us";

export interface SessionInfo {
  id: SessionId;
  label: string;
  tradingWindow: string;
  generationHour: number;   // Wann Signale generiert werden (dezimal)
  tradingStart: number;     // Handelsfenster Start
  tradingEnd: number;       // Handelsfenster Ende
}

export const SESSIONS: Record<SessionId, SessionInfo> = {
  eu: {
    id: "eu",
    label: "EU-Runde",
    tradingWindow: "09:00–11:00",
    generationHour: 8.5,    // 08:30
    tradingStart: 9,
    tradingEnd: 11,
  },
  us: {
    id: "us",
    label: "US-Runde",
    tradingWindow: "15:30–17:30",
    generationHour: 15,     // 15:00
    tradingStart: 15.5,
    tradingEnd: 17.5,
  },
};

export type SessionStatus =
  | { type: "active"; session: SessionInfo; minutesLeft: number }
  | { type: "generating"; session: SessionInfo }
  | { type: "upcoming"; session: SessionInfo; minutesUntil: number }
  | { type: "closed" };

export function getCurrentSessionStatus(): SessionStatus {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  const eu = SESSIONS.eu;
  const us = SESSIONS.us;

  // Vor EU-Generierung (vor 8:30)
  if (hour < eu.generationHour) {
    return {
      type: "upcoming",
      session: eu,
      minutesUntil: Math.floor((eu.generationHour - hour) * 60),
    };
  }

  // EU-Generierung läuft (8:30 – 9:00)
  if (hour >= eu.generationHour && hour < eu.tradingStart) {
    return { type: "generating", session: eu };
  }

  // EU-Handelsfenster aktiv (9:00 – 11:00)
  if (hour >= eu.tradingStart && hour < eu.tradingEnd) {
    return {
      type: "active",
      session: eu,
      minutesLeft: Math.floor((eu.tradingEnd - hour) * 60),
    };
  }

  // Zwischen EU und US (11:00 – 15:00)
  if (hour >= eu.tradingEnd && hour < us.generationHour) {
    return {
      type: "upcoming",
      session: us,
      minutesUntil: Math.floor((us.generationHour - hour) * 60),
    };
  }

  // US-Generierung läuft (15:00 – 15:30)
  if (hour >= us.generationHour && hour < us.tradingStart) {
    return { type: "generating", session: us };
  }

  // US-Handelsfenster aktiv (15:30 – 17:30)
  if (hour >= us.tradingStart && hour < us.tradingEnd) {
    return {
      type: "active",
      session: us,
      minutesLeft: Math.floor((us.tradingEnd - hour) * 60),
    };
  }

  // Nach Handelsschluss (ab 17:30)
  return { type: "closed" };
}

// Welche Session soll gerade generiert/angezeigt werden?
export function getRelevantSession(): SessionId | null {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  if (hour >= SESSIONS.eu.generationHour && hour < SESSIONS.us.generationHour) {
    return "eu";
  }
  if (hour >= SESSIONS.us.generationHour) {
    return "us";
  }
  return null; // Zu früh, keine Session aktiv
}
