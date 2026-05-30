"use client";

import { createClient } from "@/lib/supabase/client";

// ── Push Queue ──────────────────
// Speichert geplante Push-Notifications in Supabase.
// Der Server-Cron (/api/push/send) prüft alle 10 Min ob welche fällig sind.

async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// Close-Reminder in Queue eintragen (30 min vor Marktschluss)
export async function queueCloseReminder(
  signalId: string,
  asset: string,
  marketCloseTime: string
) {
  const userId = await getUserId();
  if (!userId) return;

  // "17:30" oder "22:00" → heute um diese Uhrzeit minus 30 min
  const match = marketCloseTime.match(/(\d{1,2}):(\d{2})/);
  if (!match) return;

  const fireAt = new Date();
  const closeHour = parseInt(match[1]);
  const closeMin = parseInt(match[2]);
  fireAt.setHours(closeHour, closeMin - 30, 0, 0);

  // Schon vorbei? Nicht eintragen.
  if (fireAt <= new Date()) return;

  const supabase = createClient();
  await supabase.from("push_queue").upsert(
    {
      user_id: userId,
      signal_id: signalId,
      title: "Trades noch offen",
      body: "Check deine Positionen bevor du Feierabend machst.",
      fire_at: fireAt.toISOString(),
      sent: false,
    },
    { onConflict: "user_id,signal_id" }
  );
}

// Close-Reminder aus Queue entfernen (wenn Position geschlossen wird)
export async function unqueueCloseReminder(signalId: string) {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = createClient();
  await supabase
    .from("push_queue")
    .delete()
    .eq("user_id", userId)
    .eq("signal_id", signalId);
}
