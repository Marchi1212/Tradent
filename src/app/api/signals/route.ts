import { NextResponse } from "next/server";
import { getTodaySignals, saveTodaySignals, todaySignalsExist, getScanCandidates } from "@/lib/signal-store";
import { generateSignals } from "@/lib/signal-generator";
import { getTradingDayType } from "@/lib/market-hours";
import webPush from "web-push";

export const maxDuration = 60;

export async function GET() {
  try {
    // 1. Prüfen ob heute schon finale Signale existieren
    const existing = await getTodaySignals();
    if (existing) {
      return NextResponse.json({ signals: existing });
    }

    // 2. Zeitpunkt + Tagestyp prüfen
    const now = new Date();
    const cetStr = now.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
    const cet = new Date(cetStr);
    const currentMinutes = cet.getHours() * 60 + cet.getMinutes();
    const dayType = getTradingDayType(cet);
    const isWeekendDay = dayType === "weekend";

    // Wochentag: Zwei-Stufen-System — finale Signale erst ab 13:30
    // WE: 08:00, Feiertage: 08:30 (Single-Generierung wie bisher)
    let minMinutes: number;
    if (dayType === "weekday") {
      minMinutes = 13 * 60 + 30; // 13:30 CET
    } else if (isWeekendDay) {
      minMinutes = 8 * 60; // 08:00
    } else {
      minMinutes = 8 * 60 + 30; // 08:30 (Feiertage)
    }

    if (currentMinutes < minMinutes) {
      const waitUntil = dayType === "weekday" ? "13:30"
        : isWeekendDay ? "08:00" : "08:30";
      return NextResponse.json({ waitUntil, isWeekend: isWeekendDay });
    }

    // 3. Double-Check gegen Race Conditions
    const exists = await todaySignalsExist();
    if (exists) {
      const signals = await getTodaySignals();
      return NextResponse.json({ signals });
    }

    // 4. An Wochentagen: Shortlist aus Morgen-Scan nutzen
    let shortlist = undefined;
    if (dayType === "weekday") {
      const candidates = await getScanCandidates();
      if (candidates && candidates.length >= 2) {
        shortlist = candidates;
        console.log(`Shortlist aus Morgen-Scan: ${candidates.map(c => c.asset).join(", ")}`);
      } else {
        console.log("Kein Morgen-Scan vorhanden — generiere aus allen Assets");
      }
    }

    // 5. Claude API + Marktdaten
    console.log("Generiere finale Signale...");
    const generated = await generateSignals(shortlist);

    // 6. Speichern
    await saveTodaySignals(generated);

    // 7. Push-Notification: "Signale sind da"
    try {
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      if (vapidPublic && vapidPrivate) {
        webPush.setVapidDetails("mailto:tradent@tradent-beta.vercel.app", vapidPublic, vapidPrivate);
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const { data: allSubs } = await supabase
          .from("push_subscriptions")
          .select("user_id, subscription");

        if (allSubs) {
          const steady = generated.find(s => s.riskClass === "steady");
          const bold = generated.find(s => s.riskClass === "bold");
          const assets = [steady?.asset, bold?.asset].filter(Boolean).join(" & ");

          for (const sub of allSubs) {
            if (!sub.subscription) continue;
            try {
              await webPush.sendNotification(sub.subscription, JSON.stringify({
                title: "Signale sind da",
                body: `${assets} — jetzt Trade prüfen.`,
                tag: "daily-signals",
              }));
            } catch (err) {
              const pushErr = err as { statusCode?: number };
              if (pushErr.statusCode === 410) {
                await supabase.from("push_subscriptions").delete().eq("user_id", sub.user_id);
              }
            }
          }
        }
      }
    } catch (pushErr) {
      console.error("Signal-Push fehlgeschlagen:", pushErr);
    }

    // 8. Gespeicherte Signale zurückgeben
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
