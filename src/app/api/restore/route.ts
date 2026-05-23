import { NextResponse } from "next/server";

// TEMPORÄR – Portfolio + Trades wiederherstellen
// Nach Benutzung löschen!

export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // User prüfen
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    // Prüfen ob schon ein aktives Portfolio existiert
    const { data: existing } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Es gibt bereits ein aktives Portfolio", id: existing.id });
    }

    // Portfolio erstellen
    const { data: portfolio, error: pError } = await supabase
      .from("portfolios")
      .insert({
        user_id: user.id,
        name: "XTB Testdepot",
        budget: 500,
        current_balance: 500,
        risk_steady: 0,
        risk_bold: 0,
        is_active: true,
      })
      .select()
      .single();

    if (pError) throw pError;

    // Balance wird beim nächsten Laden automatisch reconciled

    return NextResponse.json({
      success: true,
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        budget: portfolio.budget,
      },
      message: "XTB Testdepot wiederhergestellt. Lade die App neu.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler" },
      { status: 500 }
    );
  }
}
