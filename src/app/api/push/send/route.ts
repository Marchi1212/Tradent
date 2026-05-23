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
