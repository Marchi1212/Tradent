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

// ── Börsen-Feiertagskalender ──────────────────────────────────
// WICHTIG: Das sind die BÖRSEN-Feiertage (Exchange Holidays),
// NICHT die gesetzlichen Landes-Feiertage!
// Quellen: deutsche-boerse.com/xetra, nyse.com/markets/hours-calendars

// Ostern per Computus-Algorithmus (für bewegliche Feiertage)
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

// ── XETRA Exchange Holidays (Deutsche Börse) ──────────────────
// Quelle: deutsche-boerse.com — jährlicher Handelskalender
// NICHT identisch mit deutschen gesetzlichen Feiertagen!
// z.B. Pfingstmontag, Christi Himmelfahrt, Tag der Dt. Einheit → XETRA OFFEN
function getXetraHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const holidays = [
    new Date(year, 0, 1),    // Neujahr
    addDays(easter, -2),     // Karfreitag
    addDays(easter, 1),      // Ostermontag
    new Date(year, 4, 1),    // Tag der Arbeit
    new Date(year, 11, 24),  // Heiligabend
    new Date(year, 11, 25),  // 1. Weihnachtsfeiertag
    new Date(year, 11, 26),  // 2. Weihnachtsfeiertag
    new Date(year, 11, 31),  // Silvester
  ];
  // Nur Wochentage (Sa/So sind eh Wochenende)
  return new Set(holidays.filter(d => d.getDay() !== 0 && d.getDay() !== 6).map(dateKey));
}

// ── NYSE Exchange Holidays ────────────────────────────────────
// Quelle: nyse.com/markets/hours-calendars
function getNYSEHolidays(year: number): Set<string> {
  const holidays: Date[] = [];

  // Neujahr (1. Jan, bei Sa → Fr davor, bei So → Mo danach)
  let ny = new Date(year, 0, 1);
  if (ny.getDay() === 6) ny = new Date(year - 1, 11, 31);
  if (ny.getDay() === 0) ny = new Date(year, 0, 2);
  holidays.push(ny);

  // MLK Day (3. Montag im Januar)
  holidays.push(nthWeekday(year, 0, 1, 3));

  // Presidents' Day (3. Montag im Februar)
  holidays.push(nthWeekday(year, 1, 1, 3));

  // Good Friday (Karfreitag)
  holidays.push(addDays(easterSunday(year), -2));

  // Memorial Day (letzter Montag im Mai)
  holidays.push(lastWeekday(year, 4, 1));

  // Juneteenth (19. Juni, observed)
  holidays.push(observedDate(new Date(year, 5, 19)));

  // Independence Day (4. Juli, observed)
  holidays.push(observedDate(new Date(year, 6, 4)));

  // Labor Day (1. Montag im September)
  holidays.push(nthWeekday(year, 8, 1, 1));

  // Thanksgiving (4. Donnerstag im November)
  holidays.push(nthWeekday(year, 10, 4, 4));

  // Christmas (25. Dez, observed)
  holidays.push(observedDate(new Date(year, 11, 25)));

  return new Set(holidays.map(dateKey));
}

// N-ter Wochentag im Monat (z.B. 3. Montag im Januar)
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  let dayOfWeek = first.getDay();
  let diff = weekday - dayOfWeek;
  if (diff < 0) diff += 7;
  return new Date(year, month, 1 + diff + (n - 1) * 7);
}

// Letzter Wochentag im Monat (z.B. letzter Montag im Mai)
function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  let diff = last.getDay() - weekday;
  if (diff < 0) diff += 7;
  return new Date(year, month + 1, -diff);
}

// Observed Date: Sa → Fr davor, So → Mo danach
function observedDate(d: Date): Date {
  if (d.getDay() === 6) return addDays(d, -1);
  if (d.getDay() === 0) return addDays(d, 1);
  return d;
}

// ── LSE Exchange Holidays (London Stock Exchange) ─────────────
// Quelle: londonstockexchange.com — Bank Holidays England & Wales
function getLSEHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const holidays: Date[] = [
    new Date(year, 0, 1),        // New Year's Day
    addDays(easter, -2),         // Good Friday
    addDays(easter, 1),          // Easter Monday
    nthWeekday(year, 4, 1, 1),   // Early May Bank Holiday (1. Montag im Mai)
    lastWeekday(year, 4, 1),     // Spring Bank Holiday (letzter Montag im Mai)
    lastWeekday(year, 7, 1),     // Summer Bank Holiday (letzter Montag im August)
  ];

  // Christmas + Boxing Day: spezielle observed-Regeln als Paar
  const dec25 = new Date(year, 11, 25);
  const dec26 = new Date(year, 11, 26);
  if (dec25.getDay() === 6) {
    // 25.=Sa, 26.=So → Mo 27. + Di 28.
    holidays.push(new Date(year, 11, 27), new Date(year, 11, 28));
  } else if (dec25.getDay() === 0) {
    // 25.=So, 26.=Mo → Mo 26. (Boxing) + Di 27. (Christmas observed)
    holidays.push(new Date(year, 11, 26), new Date(year, 11, 27));
  } else if (dec26.getDay() === 6) {
    // 26.=Sa → 25. (Fr) normal + Mo 28. (Boxing observed)
    holidays.push(dec25, new Date(year, 11, 28));
  } else {
    holidays.push(dec25, dec26);
  }

  return new Set(holidays.filter(d => d.getDay() !== 0 && d.getDay() !== 6).map(dateKey));
}

// ── JPX Exchange Holidays (Japan Exchange Group / Tokyo SE) ───
// Quelle: jpx.co.jp — Market Holidays
// Japan hat viele Feiertage + Substitute Holiday Rule (So → Mo frei)

function jpxVernalEquinox(year: number): number {
  // Shunbun no Hi — Approximation (±0 Tage für 2000-2099)
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function jpxAutumnalEquinox(year: number): number {
  // Shūbun no Hi — Approximation (±0 Tage für 2000-2099)
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

// Japan Substitute Holiday: wenn Feiertag auf Sonntag fällt → Montag frei
function jpxObserved(d: Date): Date {
  if (d.getDay() === 0) return addDays(d, 1);
  return d;
}

function getJPXHolidays(year: number): Set<string> {
  const holidays: Date[] = [
    new Date(year, 0, 1),                     // Ganjitsu (Neujahr)
    new Date(year, 0, 2),                     // JPX Neujahrs-Pause
    new Date(year, 0, 3),                     // JPX Neujahrs-Pause
    nthWeekday(year, 0, 1, 2),                // Seijin no Hi (Coming of Age, 2. Mo Jan)
    jpxObserved(new Date(year, 1, 11)),       // Kenkoku Kinen no Hi (National Foundation)
    jpxObserved(new Date(year, 1, 23)),       // Tennō Tanjōbi (Emperor's Birthday)
    jpxObserved(new Date(year, 2, jpxVernalEquinox(year))), // Shunbun no Hi
    jpxObserved(new Date(year, 3, 29)),       // Shōwa no Hi (Showa Day)
    jpxObserved(new Date(year, 4, 3)),        // Kenpō Kinenbi (Constitution Memorial)
    jpxObserved(new Date(year, 4, 4)),        // Midori no Hi (Greenery Day)
    jpxObserved(new Date(year, 4, 5)),        // Kodomo no Hi (Children's Day)
    nthWeekday(year, 6, 1, 3),                // Umi no Hi (Marine Day, 3. Mo Jul)
    jpxObserved(new Date(year, 7, 11)),       // Yama no Hi (Mountain Day)
    nthWeekday(year, 8, 1, 3),                // Keirō no Hi (Respect for Aged, 3. Mo Sep)
    jpxObserved(new Date(year, 8, jpxAutumnalEquinox(year))), // Shūbun no Hi
    nthWeekday(year, 9, 1, 2),                // Supōtsu no Hi (Sports Day, 2. Mo Okt)
    jpxObserved(new Date(year, 10, 3)),       // Bunka no Hi (Culture Day)
    jpxObserved(new Date(year, 10, 23)),      // Kinrō Kansha no Hi (Labor Thanksgiving)
    new Date(year, 11, 31),                   // JPX Jahresende
  ];

  // Kokumin no Kyūjitsu: Wenn ein Tag zwischen zwei Feiertagen liegt → auch frei
  // Häufigster Fall: 22. Sep zwischen Keirō no Hi und Shūbun no Hi
  const keiro = nthWeekday(year, 8, 1, 3);
  const equinox = new Date(year, 8, jpxAutumnalEquinox(year));
  if (equinox.getTime() - keiro.getTime() === 2 * 86400000) {
    holidays.push(addDays(keiro, 1)); // Tag dazwischen
  }

  return new Set(holidays.filter(d => d.getDay() !== 0 && d.getDay() !== 6).map(dateKey));
}

// ── CME/NYMEX/COMEX Closures ─────────────────────────────────
// Quelle: cmegroup.com/trading-hours.html
// CME ist nur an 3 Tagen KOMPLETT geschlossen.
// An anderen NYSE-Feiertagen: reduzierte Stunden (Close ~19:00 CET)
function getCMEClosures(year: number): Set<string> {
  const holidays = [
    observedDate(new Date(year, 0, 1)),   // New Year's Day
    addDays(easterSunday(year), -2),      // Good Friday
    observedDate(new Date(year, 11, 25)), // Christmas Day
  ];
  return new Set(holidays.filter(d => d.getDay() !== 0 && d.getDay() !== 6).map(dateKey));
}

// ── Export: Börsen-Status-Checks ──────────────────────────────

export function isLSEHoliday(date: Date = new Date()): boolean {
  return getLSEHolidays(date.getFullYear()).has(dateKey(date));
}

export function isJPXHoliday(date: Date = new Date()): boolean {
  return getJPXHolidays(date.getFullYear()).has(dateKey(date));
}

export function isCMEClosed(date: Date = new Date()): boolean {
  return getCMEClosures(date.getFullYear()).has(dateKey(date));
}

// CME hat reduzierte Stunden an NYSE-Feiertagen (wo CME nicht ganz zu ist)
export function isCMEReducedHours(date: Date = new Date()): boolean {
  return isNYSEHoliday(date) && !isCMEClosed(date);
}

// Zusammenfassung aller Börsen-Hinweise für den Claude-Prompt
export function getExchangeNotes(date: Date = new Date()): string[] {
  const notes: string[] = [];

  if (isLSEHoliday(date)) {
    notes.push("⚠️ LSE geschlossen — UK100 CFD hat reduzierte Handelszeiten (~01:00–19:00 CET)");
  }
  if (isJPXHoliday(date)) {
    notes.push("⚠️ JPX geschlossen — JAP225 CFD hat reduzierte Handelszeiten (~01:15–19:00 CET)");
  }
  if (isCMEClosed(date)) {
    notes.push("⚠️ CME geschlossen — Rohstoff-CFDs (Gold, Silber, Platin, Öl, Erdgas) NICHT handelbar");
  } else if (isCMEReducedHours(date)) {
    notes.push("⚠️ CME Feiertag — Rohstoff-CFDs schließen früher (~19:00–20:30 CET statt 23:00)");
  }

  return notes;
}

export type TradingDayType = "weekday" | "weekend" | "xetra_closed" | "double_holiday" | "nyse_closed";

export function getTradingDayType(date: Date = new Date()): TradingDayType {
  const day = date.getDay(); // 0=So, 6=Sa
  if (day === 0 || day === 6) return "weekend";

  const xetraHolidays = getXetraHolidays(date.getFullYear());
  const nyseHolidays = getNYSEHolidays(date.getFullYear());
  const key = dateKey(date);
  const isXetraClosed = xetraHolidays.has(key);
  const isNYSEClosed = nyseHolidays.has(key);

  if (isXetraClosed && isNYSEClosed) return "double_holiday";
  if (isXetraClosed) return "xetra_closed";
  if (isNYSEClosed) return "nyse_closed";
  return "weekday";
}

export function isNYSEHoliday(date: Date = new Date()): boolean {
  return getNYSEHolidays(date.getFullYear()).has(dateKey(date));
}

export function isWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isXetraHoliday(date: Date = new Date()): boolean {
  return getXetraHolidays(date.getFullYear()).has(dateKey(date));
}

// Rückwärtskompatibel — wird im Dashboard noch verwendet
export function isGermanHoliday(date: Date = new Date()): boolean {
  return isXetraHoliday(date);
}

export function isUSHoliday(date: Date = new Date()): boolean {
  return isNYSEHoliday(date);
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
      marketPhase: "open" as const,
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
    const isPreMarket = currentHour < hours.open;
    let hoursUntilOpen: number;
    if (isPreMarket) {
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
      marketPhase: isPreMarket ? "premarket" as const : "post_close" as const,
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
      marketPhase: "closing_soon" as const,
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
    marketPhase: "open" as const,
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
