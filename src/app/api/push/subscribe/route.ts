import { NextResponse } from "next/server";

// POST: Push-Subscription speichern
// Body: { subscription: PushSubscriptionJSON }
export async function POST(request: Request) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { subscription } = await request.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Ungültige Subscription" }, { status: 400 });
    }

    // Upsert: pro User eine Subscription (ersetzt alte bei neuem Browser/Gerät)
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription: subscription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Push-Subscription speichern fehlgeschlagen:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Push-Subscribe Fehler:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
