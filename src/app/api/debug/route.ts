import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  if (action === "delete-today") {
    const { data: deleted, error } = await supabase
      .from("signals")
      .delete()
      .eq("date", today)
      .eq("session", "daily")
      .select("id, asset");

    return NextResponse.json({ deleted: deleted || [], error: error?.message });
  }

  const { data: signals } = await supabase
    .from("signals")
    .select("id, asset, date, created_at, session, risk_class")
    .eq("date", today)
    .eq("session", "daily");

  const cetNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));

  return NextResponse.json({
    serverTimeUTC: new Date().toISOString(),
    serverTimeCET: cetNow.toISOString(),
    todayDate: today,
    signals: signals || [],
  });
}
