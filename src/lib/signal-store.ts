import type { Signal } from "./mock-signals";
import type { ScanCandidate } from "./signal-generator";

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
  const supabase = await getServerClient();
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

// ── Scan-Kandidaten (Pre-Analysis) ──────────────────

export async function saveScanCandidates(candidates: ScanCandidate[]): Promise<void> {
  const supabase = await getServerClient();
  const today = new Date().toISOString().split("T")[0];

  const rows = candidates.map((c, i) => ({
    date: today,
    session: "scan",
    risk_class: `candidate_${i}`,
    asset: c.asset,
    ticker: c.ticker,
    direction: c.direction,
    leverage: "–",
    entry: 0,
    stop_loss: 0,
    take_profit: 0,
    confidence: c.confidence,
    expected_gain_percent: 0,
    risk_reward_ratio: "–",
    reasoning: c.note,
    market: c.market,
    market_close_time: "",
    optimal_entry: "",
    category: c.category,
  }));

  const { error } = await supabase.from("signals").insert(rows);
  if (error) throw error;
}

export async function getScanCandidates(): Promise<ScanCandidate[] | null> {
  const supabase = await getServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("date", today)
    .eq("session", "scan")
    .order("confidence", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return data.map((row: Record<string, unknown>) => ({
    asset: row.asset as string,
    ticker: row.ticker as string,
    category: row.category as string,
    market: row.market as string,
    direction: row.direction as "LONG" | "SHORT",
    confidence: Number(row.confidence),
    note: row.reasoning as string,
  }));
}

export async function scanCandidatesExist(): Promise<boolean> {
  const supabase = await getServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("signals")
    .select("*", { count: "exact", head: true })
    .eq("date", today)
    .eq("session", "scan");

  if (error) return false;
  return (count ?? 0) >= 2;
}
