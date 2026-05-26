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
  exitPrice?: number;
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
    exitPrice: row.exit_price != null ? Number(row.exit_price) : undefined,
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | undefined,
  };
}

// Balance aus Original-Budget + Trades korrekt berechnen (idempotent)
async function reconcileBalance(portfolioId: string, originalBudget: number): Promise<number | null> {
  const supabase = createClient();

  const { data: trades, error } = await supabase
    .from("trades")
    .select("budget, result, status")
    .eq("portfolio_id", portfolioId);

  if (error || !trades) return null;

  let balance = originalBudget;

  for (const trade of trades) {
    if (trade.status === "open") {
      // Offene Position: Budget ist gebunden
      balance -= Number(trade.budget);
    } else if (trade.status === "closed") {
      // Geschlossene Position: nur P&L zählt (Budget bereits zurück)
      balance += Number(trade.result || 0);
    }
  }

  // In DB korrigieren wenn nötig
  await supabase
    .from("portfolios")
    .update({ current_balance: balance })
    .eq("id", portfolioId);

  return balance;
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
  if (!data) return null;

  const portfolio = toPortfolio(data);

  // Balance-Reconciliation: immer korrekt berechnen
  const correctBalance = await reconcileBalance(portfolio.id, portfolio.budget);
  if (correctBalance !== null && Math.abs(correctBalance - portfolio.currentBalance) > 0.01) {
    portfolio.currentBalance = correctBalance;
  }

  return portfolio;
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

// ── Kelly Criterion + Barbell-Strategie ──────────────────────────
//
// Akademische Grundlage:
// - Half Kelly (fraction=0.5): 75% des Wachstums, 50% weniger Varianz
// - Simultane Bets: Einsätze proportional zum Kelly-Edge, nicht unabhängig
// - Barbell: Steady (sicher) dominiert, Bold (riskant) bekommt Minimum
//
// Regeln:
// 1. Mindest-Allokation: Jedes Signal bekommt min. 20% des Budgets
// 2. Exposure-Cap: Max. 90% des Budgets werden eingesetzt, 10% Reserve
// 3. Aufteilung nach Kelly-Edge (proportional), nicht 50/50
// 4. Allokation wird einmal berechnet und bleibt fix (kein Recalc nach Trade)
//
const KELLY_FRACTION = 0.5;
const MIN_ALLOCATION_PERCENT = 0.20;  // Mindestens 20% pro Signal
const MAX_EXPOSURE_PERCENT = 0.90;    // Max 90% des Budgets einsetzen

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
// Verwendet das ORIGINAL-Budget (nicht den aktuellen Balance nach Trades)
export function allocateCapital(
  budget: number,
  signals: SignalInput[]
): number[] {
  if (signals.length === 0) return [];

  const maxExposure = budget * MAX_EXPOSURE_PERCENT;
  const minPerSignal = budget * MIN_ALLOCATION_PERCENT;

  // Kelly-Edge pro Signal berechnen
  const kellys = signals.map(s => kellyPercent(s.confidence, s.riskRewardRatio));

  // Rohe Positionen berechnen (basierend auf vollem Budget)
  const rawPositions = signals.map((s, i) =>
    kellys[i] > 0
      ? rawPositionSize(budget, kellys[i], s.stopLossPercent, s.leverage)
      : 0
  );

  // Mindest-Allokation erzwingen: kein Signal unter 20% des Budgets
  const positions = rawPositions.map(p => Math.max(p, minPerSignal));

  // Exposure-Cap: Gesamtsumme darf max. 90% des Budgets sein
  const total = positions.reduce((a, b) => a + b, 0);
  if (total > maxExposure) {
    const scale = maxExposure / total;
    return positions.map(p => Math.floor(p * scale));
  }

  return positions.map(p => Math.floor(p));
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

// Offene Trades mit Ticker + Kategorie aus dem Signal (für Close-Flow im Trades-Tab)
export interface OpenTradeWithSignal extends Trade {
  ticker: string;
  category: string;
}

export async function getOpenTrades(portfolioId: string): Promise<OpenTradeWithSignal[]> {
  const supabase = createClient();

  // 1. Offene Trades laden
  const { data: tradesData, error: tradesError } = await supabase
    .from("trades")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (tradesError) throw tradesError;
  if (!tradesData || tradesData.length === 0) return [];

  const trades = tradesData.map(toTrade);

  // 2. Signal-Infos (Ticker + Kategorie) für diese Trades laden
  const signalIds = [...new Set(trades.map((t: Trade) => t.signalId))];
  const { data: signalsData } = await supabase
    .from("signals")
    .select("id, ticker, category")
    .in("id", signalIds);

  const signalMap = new Map<string, { ticker: string; category: string }>();
  for (const s of (signalsData || []) as { id: string; ticker: string; category: string }[]) {
    signalMap.set(s.id, { ticker: s.ticker, category: s.category });
  }

  return trades.map((t: Trade) => ({
    ...t,
    ticker: signalMap.get(t.signalId)?.ticker || "",
    category: signalMap.get(t.signalId)?.category || "",
  }));
}

export async function getOpenTradeForSignal(portfolioId: string, signalId: string): Promise<Trade | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .eq("signal_id", signalId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toTrade(data) : null;
}

export async function getTradeForSignal(portfolioId: string, signalId: string): Promise<Trade | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .eq("signal_id", signalId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toTrade(data) : null;
}

export async function closeTrade(
  tradeId: string,
  exitPrice: number,
  result: number
): Promise<void> {
  const supabase = createClient();

  // 1. Trade schließen
  const { error: tradeError } = await supabase
    .from("trades")
    .update({
      status: "closed",
      result,
      exit_price: exitPrice,
      closed_at: new Date().toISOString(),
    })
    .eq("id", tradeId);

  if (tradeError) throw tradeError;

  // 2. Trade laden um Portfolio-ID zu bekommen
  const { data: trade, error: fetchError } = await supabase
    .from("trades")
    .select("portfolio_id, budget")
    .eq("id", tradeId)
    .single();

  if (fetchError) throw fetchError;

  // 3. Portfolio-Guthaben aktualisieren (Budget zurückgeben + Ergebnis)
  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("current_balance")
    .eq("id", trade.portfolio_id)
    .single();

  if (portfolioError) throw portfolioError;

  // Budget wurde beim Öffnen abgezogen → jetzt zurück + P&L
  const newBalance = Number(portfolio.current_balance) + Number(trade.budget) + result;

  const { error: updateError } = await supabase
    .from("portfolios")
    .update({ current_balance: newBalance })
    .eq("id", trade.portfolio_id);

  if (updateError) throw updateError;
}

export async function deletePortfolio(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await getUserId();

  // Zuerst alle zugehörigen Trades löschen (keine Geister-Trades)
  const { error: tradesError } = await supabase
    .from("trades")
    .delete()
    .eq("portfolio_id", id);

  if (tradesError) throw tradesError;

  // Dann Portfolio löschen
  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id);

  if (error) throw error;

  // Falls noch andere Portfolios existieren: erstes aktivieren
  const { data: remaining } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (remaining && remaining.length > 0) {
    await supabase
      .from("portfolios")
      .update({ is_active: true })
      .eq("id", remaining[0].id);
  }
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

  // Budget vom Portfolio-Guthaben abziehen
  const { data: portfolio, error: pError } = await supabase
    .from("portfolios")
    .select("current_balance")
    .eq("id", trade.portfolioId)
    .single();

  if (!pError && portfolio) {
    const newBalance = Number(portfolio.current_balance) - trade.budget;
    await supabase
      .from("portfolios")
      .update({ current_balance: newBalance })
      .eq("id", trade.portfolioId);
  }

  return toTrade(row);
}
