import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: signals, error } = await supabase
    .from("signals")
    .select("*")
    .gte("date", "2026-06-16")
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: trades, error: tradeErr } = await supabase
    .from("trades")
    .select("*")
    .gte("opened_at", "2026-06-16T00:00:00")
    .order("opened_at", { ascending: true });

  return NextResponse.json({
    signalCount: signals?.length ?? 0,
    tradeCount: trades?.length ?? 0,
    signals: signals ?? [],
    trades: trades ?? [],
  });
}
