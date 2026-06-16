import { NextResponse } from "next/server";
import { getScanCandidates } from "@/lib/signal-store";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "old";

  try {
    if (action === "old") {
      const oldCandidates = await getScanCandidates();
      return NextResponse.json({ candidates: oldCandidates });
    }

    if (action === "clear") {
      const supabase = createAdminClient();
      await supabase.storage.from("cache").remove(["scan-candidates.json"]);
      return NextResponse.json({ cleared: true, info: "Now call /api/signals/scan to regenerate with new indicators" });
    }

    return NextResponse.json({ error: "Use ?action=old or ?action=clear" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
