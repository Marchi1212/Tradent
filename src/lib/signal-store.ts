import type { Signal } from "./mock-signals";
import type { ScanCandidate } from "./signal-generator";
import { createAdminClient } from "@/lib/supabase/admin";

async function getServerClient() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

function toSignal(row: Record<string, unknown>): Signal {
  return {
    id: row.id as string,
    asset: row.asset as string,
    ticker: row.ticker as string,
    direction: row.direction as "LONG" | "SHORT",
    riskClass: row.risk_class as "steady" | "bold",
    leverage: row.leverage as string,
    entry: Number(row.entry),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    confidence: Number(row.confidence),
    expectedGainPercent: Number(row.expected_gain_percent),
    riskRewardRatio: row.risk_reward_ratio as string,
    reasoning: row.reasoning as string,
    market: row.market as string,
    marketStatus: "open",
    marketCloseTime: row.market_close_time as string,
    optimalEntry: row.optimal_entry as string,
    category: row.category as string,
  };
}

// Heutige Signale laden (server-seitig)
export async function getTodaySignals(): Promise<{
  steady: Signal;
  bold: Signal;
} | null> {
  const supabase = await getServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("date", today)
    .eq("session", "daily");

  if (error) throw error;
  if (!data || data.length < 2) return null;

  const signals: Signal[] = data.map(toSignal);
  const steady = signals.find((s: Signal) => s.riskClass === "steady");
  const bold = signals.find((s: Signal) => s.riskClass === "bold");

  if (!steady || !bold) return null;
  return { steady, bold };
}

// Prüfen ob heute schon Signale existieren
export async function todaySignalsExist(): Promise<boolean> {
  const supabase = await getServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("signals")
    .select("*", { count: "exact", head: true })
    .eq("date", today)
    .eq("session", "daily");

  if (error) return false;
  return (count ?? 0) >= 2;
}

// Signale speichern (server-seitig)
export async function saveTodaySignals(signals: {
  steady: {
    asset: string;
    ticker: string;
    direction: string;
    leverage: string;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
    expectedGainPercent: number;
    riskRewardRatio: string;
    reasoning: string;
    market: string;
    marketCloseTime: string;
    optimalEntry: string;
    category: string;
  };
  bold: {
    asset: string;
    ticker: string;
    direction: string;
    leverage: string;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
    expectedGainPercent: number;
    riskRewardRatio: string;
    reasoning: string;
    market: string;
    marketCloseTime: string;
    optimalEntry: string;
    category: string;
  };
}): Promise<void> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const rows = [signals.steady, signals.bold].map((s, i) => ({
    date: today,
    session: "daily",
    risk_class: i === 0 ? "steady" : "bold",
    asset: s.asset,
    ticker: s.ticker,
    direction: s.direction,
    leverage: s.leverage,
    entry: s.entry,
    stop_loss: s.stopLoss,
    take_profit: s.takeProfit,
    confidence: s.confidence,
    expected_gain_percent: s.expectedGainPercent,
    risk_reward_ratio: s.riskRewardRatio,
    reasoning: s.reasoning,
    market: s.market,
    market_close_time: s.marketCloseTime,
    optimal_entry: s.optimalEntry,
    category: s.category,
  }));

  const { error } = await supabase.from("signals").insert(rows);
  if (error) throw error;
}

// ── Scan-Kandidaten (Pre-Analysis) via Supabase Storage ──────────────────

const SCAN_BUCKET = "cache";
const SCAN_PATH = "scan-candidates.json";

async function ensureBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase.storage.getBucket(SCAN_BUCKET);
  if (!data) {
    await supabase.storage.createBucket(SCAN_BUCKET, { public: false });
  }
}

export async function saveScanCandidates(candidates: ScanCandidate[]): Promise<void> {
  const supabase = createAdminClient();
  await ensureBucket(supabase);
  const today = new Date().toISOString().split("T")[0];
  const payload = JSON.stringify({ date: today, candidates });

  const { error } = await supabase.storage
    .from(SCAN_BUCKET)
    .upload(SCAN_PATH, payload, {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw error;
}

export async function getScanCandidates(): Promise<ScanCandidate[] | null> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase.storage
    .from(SCAN_BUCKET)
    .download(SCAN_PATH);

  if (error || !data) return null;

  try {
    const text = await data.text();
    const parsed = JSON.parse(text);
    if (parsed.date !== today) return null;
    return parsed.candidates as ScanCandidate[];
  } catch {
    return null;
  }
}

export async function scanCandidatesExist(): Promise<boolean> {
  const candidates = await getScanCandidates();
  return candidates !== null && candidates.length >= 2;
}
