// XTB CFD-Handelszeiten (deutsche Zeit / CET)
// Quelle: xtb.com Instrument Specifications
const MARKET_HOURS: Record<string, { open: number; close: number; label: string }> = {
  // Index-CFDs – fast 24h handelbar auf XTB
  XETRA: { open: 1.25, close: 22, label: "XTB DE40" },     // 01:15 - 22:00
  NYSE: { open: 0.08, close: 23, label: "XTB US-Index" },   // 00:05 - 23:00
  LSE: { open: 1, close: 23, label: "XTB UK100" },          // 01:00 - 23:00
  JPX: { open: 1.25, close: 22, label: "XTB JAP225" },      // 01:15 - 22:00

  // Aktien-CFDs – reguläre Börsenzeiten
  XETRA_STOCK: { open: 9, close: 17.5, label: "XETRA Aktien" },   // 09:00 - 17:30
  NYSE_STOCK: { open: 15.5, close: 22, label: "NYSE Aktien" },     // 15:30 - 22:00

  // Forex – 24/5
  Forex: { open: 0, close: 23, label: "24/5" },             // So 23:00 - Fr 22:00

  // Rohstoffe – ca. 23h/Tag auf XTB
  COMEX: { open: 0, close: 23, label: "XTB Rohstoffe" },    // ~00:00 - 23:00
  NYMEX: { open: 0, close: 23, label: "XTB Rohstoffe" },    // ~00:00 - 23:00

  // Krypto – 24/7
  Krypto: { open: 0, close: 24, label: "24/7" },
};

// Spätester sinnvoller Einstieg = 2 Stunden vor Schluss
const MIN_HOURS_BEFORE_CLOSE = 2;

// Deutsche Börsenfeiertage (XETRA geschlossen)
// Berechnet Ostern per Computus-Algorithmus, daraus die beweglichen Feiertage
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getGermanHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const holidays = [
    new Date(year, 0, 1),    // Neujahr
    addDays(easter, -2),     // Karfreitag
    addDays(easter, 1),      // Ostermontag
    new Date(year, 4, 1),    // Tag der Arbeit
    addDays(easter, 39),     // Christi Himmelfahrt
    addDays(easter, 50),     // Pfingstmontag
    new Date(year, 9, 3),    // Tag der Dt. Einheit
    new Date(year, 11, 25),  // 1. Weihnachtsfeiertag
    new Date(year, 11, 26),  // 2. Weihnachtsfeiertag
  ];
  return new Set(holidays.map(dateKey));
}

export type TradingDayType = "weekday" | "weekend" | "german_holiday";

export function getTradingDayType(date: Date = new Date()): TradingDayType {
  const day = date.getDay(); // 0=So, 6=Sa
  if (day === 0 || day === 6) return "weekend";
  const holidays = getGermanHolidays(date.getFullYear());
  if (holidays.has(dateKey(date))) return "german_holiday";
  return "weekday";
}

export function isWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isGermanHoliday(date: Date = new Date()): boolean {
  const holidays = getGermanHolidays(date.getFullYear());
  return holidays.has(dateKey(date));
}

export function getMarketInfo(market: string) {
  const hours = MARKET_HOURS[market] || MARKET_HOURS.XETRA;
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const totalTradingSeconds = Math.floor((hours.close - hours.open) * 3600);

  // Krypto ist immer offen
  if (market === "Krypto") {
    return {
      isOpen: true,
      canStillEnter: true,
      timerLabel: "24/7 geöffnet",
      timerSeconds: null,
      closeSeconds: null,
      totalTradingSeconds,
    };
  }

  const isOpen = currentHour >= hours.open && currentHour < hours.close;
  const lastEntry = hours.close - MIN_HOURS_BEFORE_CLOSE;
  const canStillEnter = isOpen && currentHour < lastEntry;

  const closeSeconds = isOpen
    ? Math.floor((hours.close - currentHour) * 3600)
    : null;

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
      closeSeconds: null,
      totalTradingSeconds,
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
      closeSeconds,
      totalTradingSeconds,
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
    closeSeconds,
    totalTradingSeconds,
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
