"use client";

export interface Portfolio {
  id: string;
  name: string;
  budget: number;
  currentBalance: number;
  riskSteady: number;
  riskBold: number;
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

const PORTFOLIO_KEY = "tradent_portfolios";
const ACTIVE_KEY = "tradent_active_portfolio";
const TRADES_KEY = "tradent_trades";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getPortfolios(): Portfolio[] {
  if (!isBrowser()) return [];
  const data = localStorage.getItem(PORTFOLIO_KEY);
  return data ? JSON.parse(data) : [];
}

export function getActivePortfolio(): Portfolio | null {
  if (!isBrowser()) return null;
  const id = localStorage.getItem(ACTIVE_KEY);
  if (!id) return null;
  return getPortfolios().find((p) => p.id === id) || null;
}

export function setActivePortfolio(id: string) {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function createPortfolio(data: {
  name: string;
  budget: number;
  riskSteady: number;
  riskBold: number;
}): Portfolio {
  const portfolio: Portfolio = {
    id: crypto.randomUUID(),
    name: data.name,
    budget: data.budget,
    currentBalance: data.budget,
    riskSteady: data.riskSteady,
    riskBold: data.riskBold,
    createdAt: new Date().toISOString(),
  };

  const portfolios = getPortfolios();
  portfolios.push(portfolio);
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolios));
  setActivePortfolio(portfolio.id);

  return portfolio;
}

export function updatePortfolio(
  id: string,
  updates: Partial<Pick<Portfolio, "name" | "budget" | "currentBalance" | "riskSteady" | "riskBold">>
) {
  const portfolios = getPortfolios();
  const index = portfolios.findIndex((p) => p.id === id);
  if (index === -1) return;
  portfolios[index] = { ...portfolios[index], ...updates };
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolios));
}

export function calculatePositionSize(
  balance: number,
  riskPercent: number,
  stopLossPercent: number,
  leverage: number
): number {
  const maxLoss = balance * (riskPercent / 100);
  const effectiveRisk = stopLossPercent * leverage;
  const positionSize = maxLoss / (effectiveRisk / 100);
  return Math.min(positionSize, balance);
}

export function getTrades(portfolioId: string): Trade[] {
  if (!isBrowser()) return [];
  const data = localStorage.getItem(TRADES_KEY);
  const trades: Trade[] = data ? JSON.parse(data) : [];
  return trades.filter((t) => t.portfolioId === portfolioId);
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
