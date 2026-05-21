"use client";

export interface Session {
  id: string;
  name: string;
  budget: number;
  currentBalance: number;
  riskSteady: number; // Prozent, z.B. 2
  riskBold: number; // Prozent, z.B. 5
  createdAt: string;
}

export interface Trade {
  id: string;
  sessionId: string;
  signalId: string;
  asset: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  leverage: string;
  budget: number;
  status: "open" | "closed";
  result?: number; // Gewinn/Verlust in €
  openedAt: string;
  closedAt?: string;
}

// Für Phase 1: Local State Management
// Phase 2: Supabase Datenbank

const SESSION_KEY = "tradent_sessions";
const ACTIVE_SESSION_KEY = "tradent_active_session";
const TRADES_KEY = "tradent_trades";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getSessions(): Session[] {
  if (!isBrowser()) return [];
  const data = localStorage.getItem(SESSION_KEY);
  return data ? JSON.parse(data) : [];
}

export function getActiveSession(): Session | null {
  if (!isBrowser()) return null;
  const id = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!id) return null;
  const sessions = getSessions();
  return sessions.find((s) => s.id === id) || null;
}

export function setActiveSession(id: string) {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

export function createSession(data: {
  name: string;
  budget: number;
  riskSteady: number;
  riskBold: number;
}): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    name: data.name,
    budget: data.budget,
    currentBalance: data.budget,
    riskSteady: data.riskSteady,
    riskBold: data.riskBold,
    createdAt: new Date().toISOString(),
  };

  const sessions = getSessions();
  sessions.push(session);
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  setActiveSession(session.id);

  return session;
}

export function updateSession(
  id: string,
  updates: Partial<Pick<Session, "name" | "budget" | "currentBalance" | "riskSteady" | "riskBold">>
) {
  const sessions = getSessions();
  const index = sessions.findIndex((s) => s.id === id);
  if (index === -1) return;

  sessions[index] = { ...sessions[index], ...updates };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

export function calculatePositionSize(
  balance: number,
  riskPercent: number,
  stopLossPercent: number,
  leverage: number
): number {
  // Max Verlust in €
  const maxLoss = balance * (riskPercent / 100);
  // Effektives Risiko pro Position = Stop-Loss% * Leverage
  const effectiveRisk = stopLossPercent * leverage;
  // Position Size = Max Verlust / Effektives Risiko
  const positionSize = maxLoss / (effectiveRisk / 100);
  // Nie mehr als das verfügbare Kapital
  return Math.min(positionSize, balance);
}

export function getTrades(sessionId: string): Trade[] {
  if (!isBrowser()) return [];
  const data = localStorage.getItem(TRADES_KEY);
  const trades: Trade[] = data ? JSON.parse(data) : [];
  return trades.filter((t) => t.sessionId === sessionId);
}

export function addTrade(trade: Omit<Trade, "id" | "openedAt">): Trade {
  const newTrade: Trade = {
    ...trade,
    id: crypto.randomUUID(),
    openedAt: new Date().toISOString(),
  };

  const data = localStorage.getItem(TRADES_KEY);
  const trades: Trade[] = data ? JSON.parse(data) : [];
  trades.push(newTrade);
  localStorage.setItem(TRADES_KEY, JSON.stringify(trades));

  return newTrade;
}
