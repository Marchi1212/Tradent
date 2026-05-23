"use client";

// ── Tradent Notification System ──────────────────
// Lokale Notifications via Service Worker.
// Kein Push-Server nötig – läuft im Browser-Tab (auch im Hintergrund).

let swRegistration: ServiceWorkerRegistration | null = null;

// Service Worker registrieren
export async function initNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;

  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js");
    return true;
  } catch {
    console.error("Service Worker Registrierung fehlgeschlagen");
    return false;
  }
}

// Permission anfragen (muss durch User-Geste getriggert werden)
export async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function hasPermission(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// ── Scheduling ──────────────────

const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleNotification(
  id: string,
  title: string,
  body: string,
  targetTime: Date
) {
  cancelNotification(id);

  const now = new Date();
  const delay = targetTime.getTime() - now.getTime();

  if (delay <= 0) return; // Zeit schon vorbei

  const timer = setTimeout(async () => {
    scheduledTimers.delete(id);

    if (!hasPermission()) return;

    try {
      if (swRegistration) {
        await swRegistration.showNotification(title, {
          body,
          icon: "/logo.svg",
          badge: "/logo.svg",
          tag: id,
          requireInteraction: true,
        });
      }
    } catch {
      // Fallback
      try {
        new Notification(title, { body, icon: "/logo.svg" });
      } catch {
        // Notifications nicht verfügbar
      }
    }
  }, delay);

  scheduledTimers.set(id, timer);
}

export function cancelNotification(id: string) {
  const timer = scheduledTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    scheduledTimers.delete(id);
  }
}

// ── Signal-basiertes Scheduling ──────────────────

// Parst "14:00–16:00" → Date für heute um 14:00
function parseTimeToToday(timeStr: string): Date | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const target = new Date();
  target.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
  return target;
}

// Entry-Notification: feuert wenn Einstiegsfenster beginnt
export function scheduleEntryNotification(
  signalId: string,
  asset: string,
  direction: string,
  leverage: string,
  entry: number,
  optimalEntry: string
) {
  const time = parseTimeToToday(optimalEntry);
  if (!time || time <= new Date()) return;

  scheduleNotification(
    `entry-${signalId}`,
    `Einstiegsfenster: ${asset}`,
    `${direction} · ${leverage} · Entry bei ${entry.toLocaleString("de-DE")}`,
    time
  );
}

// Close-Notification: feuert 30 min vor Marktschluss
export function scheduleCloseNotification(
  signalId: string,
  asset: string,
  marketCloseTime: string
) {
  const closeTime = parseTimeToToday(marketCloseTime);
  if (!closeTime) return;

  // 30 Minuten Puffer
  closeTime.setMinutes(closeTime.getMinutes() - 30);

  if (closeTime <= new Date()) return;

  scheduleNotification(
    `close-${signalId}`,
    `Position schließen: ${asset}`,
    "Markt schließt in 30 Minuten. Jetzt Position prüfen.",
    closeTime
  );
}

export function cancelCloseNotification(signalId: string) {
  cancelNotification(`close-${signalId}`);
}
