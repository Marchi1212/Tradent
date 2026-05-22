// Handelszeiten der Märkte (deutsche Zeit / CET)
const MARKET_HOURS: Record<string, { open: number; close: number; label: string }> = {
  XETRA: { open: 9, close: 17.5, label: "XETRA" },       // 09:00 - 17:30
  NYSE: { open: 15.5, close: 22, label: "NYSE" },          // 15:30 - 22:00
  LSE: { open: 9, close: 17.5, label: "LSE" },             // 09:00 - 17:30
  Forex: { open: 0, close: 24, label: "24/5" },            // 24h Mo-Fr
  COMEX: { open: 8.33, close: 20.5, label: "COMEX" },      // 08:20 - 20:30
  NYMEX: { open: 8.33, close: 20.5, label: "NYMEX" },      // 08:20 - 20:30
  Krypto: { open: 0, close: 24, label: "24/7" },
};

// Spätester sinnvoller Einstieg = 2 Stunden vor Schluss
const MIN_HOURS_BEFORE_CLOSE = 2;

export function getMarketInfo(market: string) {
  const hours = MARKET_HOURS[market] || MARKET_HOURS.XETRA;
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Krypto ist immer offen
  if (market === "Krypto") {
    return {
      isOpen: true,
      canStillEnter: true,
      timerLabel: "24/7 geöffnet",
      timerSeconds: null,
    };
  }

  const isOpen = currentHour >= hours.open && currentHour < hours.close;
  const lastEntry = hours.close - MIN_HOURS_BEFORE_CLOSE;
  const canStillEnter = isOpen && currentHour < lastEntry;

  if (!isOpen) {
    // Markt geschlossen → Timer bis Öffnung
    let hoursUntilOpen: number;
    if (currentHour < hours.open) {
      hoursUntilOpen = hours.open - currentHour;
    } else {
      // Nach Schluss → nächster Tag
      hoursUntilOpen = 24 - currentHour + hours.open;
    }
    const totalSeconds = Math.floor(hoursUntilOpen * 3600);

    return {
      isOpen: false,
      canStillEnter: false,
      timerLabel: "Öffnet in",
      timerSeconds: totalSeconds,
    };
  }

  if (!canStillEnter) {
    // Markt offen aber zu spät für Einstieg
    const hoursUntilClose = hours.close - currentHour;
    const totalSeconds = Math.floor(hoursUntilClose * 3600);

    return {
      isOpen: true,
      canStillEnter: false,
      timerLabel: "Schließt in",
      timerSeconds: totalSeconds,
    };
  }

  // Markt offen, Einstieg noch möglich
  const hoursUntilLastEntry = lastEntry - currentHour;
  const totalSeconds = Math.floor(hoursUntilLastEntry * 3600);

  return {
    isOpen: true,
    canStillEnter: true,
    timerLabel: "Einstieg noch",
    timerSeconds: totalSeconds,
  };
}

export function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);

  if (h > 0) {
    return `${h}h ${m}min`;
  }
  return `${m}min`;
}
