import { NextResponse } from "next/server";
import webPush from "web-push";

// GET: Fällige Push-Notifications aus der Queue senden.
// Wird alle 10 Min von cron-job.org aufgerufen.
export async function GET(request: Request) {
  try {
    // Auth-Check: nur mit CRON_SECRET erlaubt
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: "VAPID nicht konfiguriert" }, { status: 500 });
    }

    webPush.setVapidDetails(
      "mailto:tradent@tradent-beta.vercel.app",
      vapidPublic,
      vapidPrivate
    );

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    // ── Täglicher Morgen-Reminder (09:15 CET) ──
    // Cron läuft alle 10 Min → zwischen 09:10 und 09:20 CET triggern
    const cetNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
    const cetHour = cetNow.getHours();
    const cetMin = cetNow.getMinutes();
    const isMorningWindow = cetHour === 9 && cetMin >= 10 && cetMin < 20;

    if (isMorningWindow) {
      // Alle User mit Push-Subscription holen
      const { data: allSubs } = await supabase
        .from("push_subscriptions")
        .select("user_id, subscription");

      if (allSubs && allSubs.length > 0) {
        // Prüfen ob heute schon ein Morgen-Reminder gesendet wurde
        const todayStart = new Date(cetNow);
        todayStart.setHours(0, 0, 0, 0);
        const { data: alreadySent } = await supabase
          .from("push_queue")
          .select("id")
          .eq("signal_id", "daily-morning")
          .gte("fire_at", todayStart.toISOString())
          .limit(1);

        if (!alreadySent || alreadySent.length === 0) {
          for (const sub of allSubs) {
            if (!sub.subscription) continue;
            try {
              const payload = JSON.stringify({
                title: "Neue Signale verfügbar",
                body: "Deine täglichen Trading-Signale sind bereit. Jetzt prüfen.",
                tag: "daily-morning",
              });
              await webPush.sendNotification(sub.subscription, payload);
            } catch (err) {
              const pushErr = err as { statusCode?: number };
              if (pushErr.statusCode === 410) {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("user_id", sub.user_id);
              }
            }
          }
          // Marker setzen damit nicht doppelt gesendet wird
          await supabase.from("push_queue").insert({
            user_id: allSubs[0].user_id,
            signal_id: "daily-morning",
            title: "Morgen-Reminder",
            body: "gesendet",
            fire_at: new Date().toISOString(),
            sent: true,
          });
        }
      }
    }

    // ── Abendliche Signal-Evaluierung (22:00 CET) ──
    // Signale des Tages auswerten: Hat der Kurs TP oder SL erreicht?
    const isEveningWindow = cetHour === 22 && cetMin >= 0 && cetMin < 10;

    if (isEveningWindow) {
      const todayStart = new Date(cetNow);
      todayStart.setHours(0, 0, 0, 0);
      const { data: alreadyEvaluated } = await supabase
        .from("push_queue")
        .select("id")
        .eq("signal_id", "daily-evaluate")
        .gte("fire_at", todayStart.toISOString())
        .limit(1);

      if (!alreadyEvaluated || alreadyEvaluated.length === 0) {
        try {
          const todayDate = `${cetNow.getFullYear()}-${String(cetNow.getMonth() + 1).padStart(2, "0")}-${String(cetNow.getDate()).padStart(2, "0")}`;
          const baseUrl = new URL(request.url).origin;
          const evalRes = await fetch(`${baseUrl}/api/evaluate?date=${todayDate}`, {
            headers: cronSecret ? { authorization: `Bearer ${cronSecret}` } : {},
            signal: AbortSignal.timeout(50000),
          });
          const evalResult = await evalRes.json().catch(() => null);
          console.log("Signal-Evaluierung:", evalResult);
        } catch (err) {
          console.error("Signal-Evaluierung fehlgeschlagen:", err);
        }

        // Marker setzen (Dedup) – benutze ersten User mit Subscription
        const { data: anySub } = await supabase
          .from("push_subscriptions")
          .select("user_id")
          .limit(1);

        if (anySub && anySub.length > 0) {
          await supabase.from("push_queue").insert({
            user_id: anySub[0].user_id,
            signal_id: "daily-evaluate",
            title: "Signal-Evaluierung",
            body: "evaluiert",
            fire_at: new Date().toISOString(),
            sent: true,
          });
        }
      }
    }

    // ── Fällige Queue-Notifications senden ──
    // Fällige Notifications holen (fire_at <= jetzt UND noch nicht gesendet)
    const now = new Date().toISOString();
    const { data: queue, error: queueError } = await supabase
      .from("push_queue")
      .select("*")
      .eq("sent", false)
      .lte("fire_at", now);

    if (queueError) {
      console.error("Push-Queue lesen fehlgeschlagen:", queueError);
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    if (!queue || queue.length === 0) {
      return NextResponse.json({ sent: 0, message: "Keine fälligen Notifications" });
    }

    let sent = 0;
    let failed = 0;

    for (const item of queue) {
      // Push-Subscription des Users laden
      const { data: sub } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", item.user_id)
        .single();

      if (!sub?.subscription) {
        // User hat keine Push-Subscription → überspringen, als gesendet markieren
        await supabase
          .from("push_queue")
          .update({ sent: true })
          .eq("id", item.id);
        continue;
      }

      try {
        const payload = JSON.stringify({
          title: item.title,
          body: item.body,
          tag: `close-${item.signal_id}`,
        });

        await webPush.sendNotification(sub.subscription, payload);
        sent++;
      } catch (err) {
        console.error(`Push an User ${item.user_id} fehlgeschlagen:`, err);
        failed++;

        // 410 Gone = Subscription abgelaufen → löschen
        const pushErr = err as { statusCode?: number };
        if (pushErr.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", item.user_id);
        }
      }

      // Als gesendet markieren (auch bei Fehler, um Endlos-Loop zu vermeiden)
      await supabase
        .from("push_queue")
        .update({ sent: true })
        .eq("id", item.id);
    }

    // Alte Einträge aufräumen (älter als 2 Tage)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("push_queue")
      .delete()
      .lt("fire_at", twoDaysAgo);

    return NextResponse.json({ sent, failed, total: queue.length });
  } catch (err) {
    console.error("Push-Send Fehler:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
