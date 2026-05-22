"use client";

import { createClient } from "@/lib/supabase/client";

export interface Portfolio {
  id: string;
  name: string;
  budget: number;
  currentBalance: number;
  riskSteady: number;
  riskBold: number;
  isActive: boolean;
  createdAt: string;
}

export interface Trade {
  id: string;
  portfolioId: string;
  signalId: string;
  asset: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  leverage: string;
  budget: number;
  status: "open" | "closed";
  result?: number;
  openedAt: string;
  closedAt?: string;
}

// Supabase row → App-Typ
function toPortfolio(row: Record<string, unknown>): Portfolio {
  return {
    id: row.id as string,
    name: row.name as string,
    budget: Number(row.budget),
    currentBalance: Number(row.current_balance),
    riskSteady: Number(row.risk_steady),
    riskBold: Number(row.risk_bold),
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  };
}

function toTrade(row: Record<string, unknown>): Trade {
  return {
    id: row.id as string,
    portfolioId: row.portfolio_id as string,
    signalId: row.signal_id as string,
    asset: row.asset as string,
    direction: row.direction as string,
    entry: Number(row.entry),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    leverage: row.leverage as string,
    budget: Number(row.budget),
    status: row.status as "open" | "closed",
    result: row.result != null ? Number(row.result) : undefined,
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | undefined,
  };
}

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  return user.id;
}

export async function getPortfolios(): Promise<Portfolio[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(toPortfolio);
}

export async function getActivePortfolio(): Promise<Portfolio | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toPortfolio(data) : null;
}

export async function setActivePortfolio(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await getUserId();

  // Alle deaktivieren
  await supabase
    .from("portfolios")
    .update({ is_active: false })
    .eq("user_id", userId);

  // Gewähltes aktivieren
  await supabase
    .from("portfolios")
    .update({ is_active: true })
    .eq("id", id);
}

export async function createPortfolio(data: {
  name: string;
  budget: number;
  riskSteady: number;
  riskBold: number;
}): Promise<Portfolio> {
  const supabase = createClient();
  const userId = await getUserId();

  // Alle bisherigen deaktivieren
  await supabase
    .from("portfolios")
    .update({ is_active: false })
    .eq("user_id", userId);

  const { data: row, error } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name: data.name,
      budget: data.budget,
      current_balance: data.budget,
      risk_steady: data.riskSteady,
      risk_bold: data.riskBold,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return toPortfolio(row);
}

export async function updatePortfolio(
  id: string,
  updates: Partial<Pick<Portfolio, "name" | "budget" | "currentBalance" | "riskSteady" | "riskBold">>
): Promise<void> {
  const supabase = createClient();

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.budget !== undefined) dbUpdates.budget = updates.budget;
  if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
  if (updates.riskSteady !== undefined) dbUpdates.risk_steady = updates.riskSteady;
  if (updates.riskBold !== undefined) dbUpdates.risk_bold = updates.riskBold;

  const { error } = await supabase
    .from("portfolios")
    .update(dbUpdates)
    .eq("id", id);

  if (error) throw error;
}

// Kelly Criterion: optimale Positionsgroeße fuer maximale Portfolio-Performance
// Half Kelly (fraction=0.5) als Standard: 75% des Wachstums, deutlich weniger Risiko
const KELLY_FRACTION = 0.5;

interface SignalInput {
  confidence: number;       // 0-100
  riskRewardRatio: number;  // z.B. 2 fuer 1:2
  stopLossPercent: number;  // SL-Abstand in %
  leverage: number;
}

function kellyPercent(confidence: number, riskReward: number): number {
  const p = confidence / 100;
  const kelly = p - (1 - p) / riskReward;
  return Math.max(0, kelly); // Nie negativ – kein Trade wenn Edge negativ
}

function rawPositionSize(balance: number, kellyPct: number, slPercent: number, leverage: number): number {
  const maxLoss = balance * kellyPct * KELLY_FRACTION;
  const effectiveRisk = slPercent * leverage;
  return maxLoss / (effectiveRisk / 100);
}

// Berechnet optimale Aufteilung des Kapitals auf mehrere Signale
export function allocateCapital(
  balance: number,
  signals: SignalInput[]
): number[] {
  if (signals.length === 0) return [];

  // Kelly-Gewichtung pro Signal
  const kellys = signals.map(s => kellyPercent(s.confidence, s.riskRewardRatio));

  // Rohe Positionen berechnen
  const rawPositions = signals.map((s, i) =>
    kellys[i] > 0
      ? rawPositionSize(balance, kellys[i], s.stopLossPercent, s.leverage)
      : 0
  );

  // Wenn Gesamtsumme > Balance: proportional skalieren
  const total = rawPositions.reduce((a, b) => a + b, 0);
  if (total > balance) {
    const scale = balance / total;
    return rawPositions.map(p => Math.floor(p * scale));
  }

  return rawPositions.map(p => Math.floor(p));
}

// Einzelne Position (Fallback fuer einzelne Berechnung)
export function calculatePositionSize(
  balance: number,
  confidence: number,
  riskRewardRatio: number,
  stopLossPercent: number,
  leverage: number
): number {
  const kelly = kellyPercent(confidence, riskRewardRatio);
  if (kelly <= 0) return 0;
  const size = rawPositionSize(balance, kelly, stopLossPercent, leverage);
  return Math.min(Math.floor(size), balance);
}

export async function getTrades(portfolioId: string): Promise<Trade[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("opened_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(toTrade);
}

export async function deletePortfolio(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function addTrade(trade: {
  portfolioId: string;
  signalId: string;
  asset: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  leverage: string;
  budget: number;
  status: "open" | "closed";
}): Promise<Trade> {
  const supabase = createClient();
  const userId = await getUserId();

  const { data: row, error } = await supabase
    .from("trades")
    .insert({
      user_id: userId,
      portfolio_id: trade.portfolioId,
      signal_id: trade.signalId,
      asset: trade.asset,
      direction: trade.direction,
      entry: trade.entry,
      stop_loss: trade.stopLoss,
      take_profit: trade.takeProfit,
      leverage: trade.leverage,
      budget: trade.budget,
      status: trade.status,
    })
    .select()
    .single();

  if (error) throw error;
  return toTrade(row);
}
