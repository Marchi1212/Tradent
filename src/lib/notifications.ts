"use client";

// ── Tradent Notification System ──────────────────
// Server-Push via VAPID + Service Worker.
// Funktioniert auf iOS (PWA), Android und Desktop.

let swRegistration: ServiceWorkerRegistration | null = null;

// ── Base64 Helper für VAPID Key ──────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Service Worker registrieren ──────────────────
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

// ── Permission anfragen (muss durch User-Geste getriggert werden) ──
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

// ── Push-Subscription ──────────────────
// Abonniert den Browser für Server-Push und sendet die Subscription an unser Backend.
export async function subscribeToPush(): Promise<boolean> {
  if (!swRegistration) return false;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error("VAPID Public Key fehlt");
    return false;
  }

  try {
    // Bestehende Subscription prüfen
    let subscription = await swRegistration.pushManager.getSubscription();

    if (!subscription) {
      // Neue Subscription erstellen
      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as unknown as BufferSource,
      });
    }

    // Subscription an Server senden
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!res.ok) {
      console.error("Push-Subscription speichern fehlgeschlagen");
      return false;
    }

    return true;
  } catch (err) {
    console.error("Push-Subscription fehlgeschlagen:", err);
    return false;
  }
}

// ── Lokale Timer-basierte Notifications (Fallback wenn App offen) ──────

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

  if (delay <= 0) return;

  const timer = setTimeout(async () => {
    scheduledTimers.delete(id);

    if (!hasPermission()) return;

    try {
      if (swRegistration) {
        await swRegistration.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: id,
          requireInteraction: true,
        });
      }
    } catch {
      try {
        new Notification(title, { body, icon: "/icon-192.png" });
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

function parseTimeToToday(timeStr: string): Date | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const target = new Date();
  target.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
  return target;
}

// Entry-Notification: feuert wenn Einstiegsfenster beginnt (lokal)
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

// Close-Notification: lokaler Timer als Fallback (feuert nur wenn App offen)
export function scheduleCloseNotification(
  signalId: string,
  asset: string,
  marketCloseTime: string
) {
  const closeTime = parseTimeToToday(marketCloseTime);
  if (!closeTime) return;

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
