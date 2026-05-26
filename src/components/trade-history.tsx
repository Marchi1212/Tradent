"use client";

import { useState, useEffect } from "react";
import type { Trade, Portfolio, OpenTradeWithSignal } from "@/lib/portfolio-store";
import { getTrades, getOpenTrades, closeTrade, allocateCapital } from "@/lib/portfolio-store";
import { createClient } from "@/lib/supabase/client";

// XTB-Spreads als % vom Kurs (konservativ, Round-Trip)
const SPREAD_PERCENT: Record<string, number> = {
  Index: 0.03, Aktie: 0.06, Forex: 0.015, Rohstoff: 0.04, Krypto: 0.20,
};

interface SignalRecord {
  id: string;
  date: string;
  risk_class: string;
  asset: string;
  ticker: string;
  direction: string;
  leverage: string;
  entry: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  reasoning: string;
  market: string;
  category: string;
  risk_reward_ratio: string;
  outcome: string | null;
  actual_close: number | null;
  created_at: string;
}

type SubTab = "my-trades" | "all-signals";

interface Props {
  portfolio: Portfolio;
  onPortfolioUpdate?: () => void;
}

export default function TradeHistory({ portfolio, onPortfolioUpdate }: Props) {
  const portfolioId = portfolio.id;
  const [subTab, setSubTab] = useState<SubTab>("my-trades");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadTrades() {
    try {
      const t = await getTrades(portfolioId);
      setTrades(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    loadTrades();
  }, [portfolioId]);

  if (!loaded) return null;

  return (
    <div className="space-y-5">
      {/* Sub-Tabs */}
      <div className="flex rounded-[12px] bg-bg-secondary p-1 gap-1">
        <button
          onClick={() => setSubTab("my-trades")}
          className={`flex-1 rounded-[6px] py-2 text-xs font-semibold text-center transition-colors ${
            subTab === "my-trades"
              ? "bg-bg-primary text-text-primary shadow-sm"
              : "text-text-muted"
          }`}
        >
          Meine Trades
        </button>
        <button
          onClick={() => setSubTab("all-signals")}
          className={`flex-1 rounded-[6px] py-2 text-xs font-semibold text-center transition-colors ${
            subTab === "all-signals"
              ? "bg-bg-primary text-text-primary shadow-sm"
              : "text-text-muted"
          }`}
        >
          Alle Signale
        </button>
      </div>

      {subTab === "my-trades" ? (
        <MyTrades trades={trades} portfolioId={portfolioId} onTradeClose={() => { loadTrades(); onPortfolioUpdate?.(); }} />
      ) : (
        <AllSignals budget={portfolio.budget} portfolioCreatedAt={portfolio.createdAt} />
      )}
    </div>
  );
}

/* ── Meine Trades ────────────────────────────── */

function MyTrades({ trades, portfolioId, onTradeClose }: { trades: Trade[]; portfolioId: string; onTradeClose: () => void }) {
  const [openTradesWithSignal, setOpenTradesWithSignal] = useState<OpenTradeWithSignal[]>([]);

  useEffect(() => {
    getOpenTrades(portfolioId)
      .then(setOpenTradesWithSignal)
      .catch(console.error);
  }, [portfolioId, trades]);

  if (trades.length === 0 && openTradesWithSignal.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        title="Noch keine Trades"
        subtitle="Öffne eine Position bei einem Signal um zu starten."
      />
    );
  }

  const closedTrades = trades.filter((t) => t.status === "closed");
  const totalResult = closedTrades.reduce((sum, t) => sum + (t.result || 0), 0);

  return (
    <div className="space-y-5">
      {/* Zusammenfassung */}
      {closedTrades.length > 0 && (
        <div className="rounded-[12px] bg-bg-secondary p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-text-muted uppercase">Gesamt-Ergebnis</p>
              <p className={`text-xl font-black mt-1 ${totalResult >= 0 ? "text-positive" : "text-negative"}`}>
                {totalResult >= 0 ? "+" : ""}{totalResult.toFixed(2)}€
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-text-muted uppercase">Trades</p>
              <p className="text-sm font-bold text-text-primary mt-1">
                {closedTrades.length} geschlossen
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Offene Trades (mit Close-Möglichkeit) */}
      {openTradesWithSignal.length > 0 && (
        <div>
          <p className="text-[11px] text-text-muted uppercase font-semibold mb-3">
            Offen ({openTradesWithSignal.length})
          </p>
          <div className="space-y-2">
            {openTradesWithSignal.map((trade) => (
              <OpenTradeRow key={trade.id} trade={trade} onClose={onTradeClose} />
            ))}
          </div>
        </div>
      )}

      {/* Geschlossene Trades */}
      {closedTrades.length > 0 && (
        <div>
          <p className="text-[11px] text-text-muted uppercase font-semibold mb-3">
            Geschlossen ({closedTrades.length})
          </p>
          <div className="space-y-2">
            {closedTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Alle Signale ────────────────────────────── */

// Theoretisches P&L für ein Signal berechnen (was wäre passiert?)
function calcSignalPnl(signal: SignalRecord, budget: number): number | null {
  if (!signal.outcome) return null;

  const leverage = parseFloat(signal.leverage) || 1;
  const spreadPct = SPREAD_PERCENT[signal.category] || 0.05;
  const spreadCostPct = spreadPct * leverage;

  let exitPrice: number;
  if (signal.outcome === "tp_hit") exitPrice = signal.take_profit;
  else if (signal.outcome === "sl_hit") exitPrice = signal.stop_loss;
  else if (signal.actual_close) exitPrice = signal.actual_close;
  else return null;

  let movePct: number;
  if (signal.direction === "LONG") {
    movePct = ((exitPrice - signal.entry) / signal.entry) * 100 * leverage;
  } else {
    movePct = ((signal.entry - exitPrice) / signal.entry) * 100 * leverage;
  }

  // Spread-Kosten abziehen
  const netPct = movePct - spreadCostPct;
  return budget * (netPct / 100);
}

// Kelly-Inputs aus Signal-Record erstellen
function signalToKellyInput(s: SignalRecord) {
  const leverage = parseFloat(s.leverage) || 1;
  const slPercent = s.direction === "LONG"
    ? ((s.entry - s.stop_loss) / s.entry) * 100
    : ((s.stop_loss - s.entry) / s.entry) * 100;
  const rrStr = s.risk_reward_ratio || "1:1.5";
  const rr = parseFloat(rrStr.split(":")[1]) || 1.5;
  return { confidence: s.confidence, riskRewardRatio: rr, stopLossPercent: slPercent, leverage };
}

type TimeRange = "all" | "portfolio";

function AllSignals({ budget, portfolioCreatedAt }: { budget: number; portfolioCreatedAt: string }) {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }: { data: SignalRecord[] | null }) => {
        setSignals(data || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  if (signals.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        }
        title="Noch keine Signale"
        subtitle="Signale erscheinen hier sobald sie generiert wurden."
      />
    );
  }

  // Nach Zeitraum filtern
  const portfolioStart = new Date(portfolioCreatedAt);
  const filteredSignals = timeRange === "portfolio"
    ? signals.filter((s) => new Date(s.created_at) >= portfolioStart)
    : signals;

  // Nach Datum gruppieren
  const byDate = new Map<string, SignalRecord[]>();
  for (const s of filteredSignals) {
    const dateStr = new Date(s.created_at).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr)!.push(s);
  }

  // Kelly-Allokation pro Tages-Paar berechnen
  const allocationMap = new Map<string, number>();
  for (const [, daySignals] of byDate) {
    if (daySignals.length >= 2) {
      const kellyInputs = daySignals.map(signalToKellyInput);
      const allocations = allocateCapital(budget, kellyInputs);
      daySignals.forEach((s, i) => allocationMap.set(s.id, allocations[i] || 0));
    } else {
      daySignals.forEach((s) => allocationMap.set(s.id, Math.floor(budget * 0.45)));
    }
  }

  // Theoretisches Gesamtergebnis berechnen
  const evaluated = filteredSignals.filter((s) => s.outcome !== null);
  const tpCount = filteredSignals.filter((s) => s.outcome === "tp_hit").length;
  let totalTheoreticalPnl = 0;
  for (const s of evaluated) {
    const alloc = allocationMap.get(s.id) || 0;
    const pnl = calcSignalPnl(s, alloc);
    if (pnl !== null) totalTheoreticalPnl += pnl;
  }

  return (
    <div className="space-y-5">
      {/* Zusammenfassung */}
      <div className="rounded-[12px] bg-bg-secondary p-4">
        {/* Zeitraum-Dropdown */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-text-muted uppercase">Theoretisches Ergebnis</p>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="text-[11px] font-semibold text-text-muted uppercase bg-transparent border border-border rounded-[6px] px-2 py-1 outline-none cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center", paddingRight: "20px" }}
          >
            <option value="all">Seit Tradent</option>
            <option value="portfolio">Seit Depot</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xl font-black ${evaluated.length > 0 ? (totalTheoreticalPnl >= 0 ? "text-positive" : "text-negative") : "text-text-muted"}`}>
            {evaluated.length > 0 ? `${totalTheoreticalPnl >= 0 ? "+" : ""}${totalTheoreticalPnl.toFixed(2)}€` : "–"}
          </p>
          <div className="text-right">
            <p className="text-sm font-bold text-text-primary">
              {evaluated.length > 0 ? `${Math.round((tpCount / evaluated.length) * 100)}%` : "–"}
              <span className="text-text-muted font-normal"> · {filteredSignals.length} Signale</span>
            </p>
          </div>
        </div>
      </div>

      {filteredSignals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-semibold text-text-primary">Keine Signale in diesem Zeitraum</p>
          <p className="text-xs text-text-muted mt-1">Depot eröffnet am {portfolioStart.toLocaleDateString("de-DE")}</p>
        </div>
      ) : (
        Array.from(byDate.entries()).map(([date, daySignals]) => (
          <div key={date}>
            <p className="text-[11px] text-text-muted uppercase font-semibold mb-3">{date}</p>
            <div className="space-y-2">
              {daySignals.map((s) => (
                <SignalRow key={s.id} signal={s} allocatedBudget={allocationMap.get(s.id) || 0} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SignalRow({ signal, allocatedBudget }: { signal: SignalRecord; allocatedBudget: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const date = new Date(signal.created_at).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pnl = calcSignalPnl(signal, allocatedBudget);
  const hasOutcome = signal.outcome !== null;

  function outcomeLabel() {
    if (pnl !== null) {
      const isPositive = pnl >= 0;
      return (
        <span className={`text-sm font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
          {isPositive ? "+" : ""}{pnl.toFixed(2)}€
        </span>
      );
    }
    return <span className="text-xs text-white/40">ausstehend</span>;
  }

  return (
    <div className="rounded-[12px] bg-[#1A1A1A] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            signal.direction === "LONG"
              ? "bg-green-500/15 text-green-400"
              : "bg-red-500/15 text-red-400"
          }`}>
            {signal.direction === "LONG" ? "↑" : "↓"}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">{signal.asset}</p>
            <p className="text-xs text-white/55">
              {date} · {signal.leverage} · {signal.confidence}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {outcomeLabel()}
          <svg
            className={`w-4 h-4 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-white/10 pt-2">
          {/* Entry / SL / TP */}
          <div className="grid grid-cols-3 gap-3 pb-2">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Einstieg</p>
              <p className="text-sm font-bold text-white mt-0.5">{signal.entry.toLocaleString("de-DE")}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Stop-Loss</p>
              <p className="text-sm font-bold text-white mt-0.5">{signal.stop_loss.toLocaleString("de-DE")}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Take-Profit</p>
              <p className="text-sm font-bold text-white mt-0.5">{signal.take_profit.toLocaleString("de-DE")}</p>
            </div>
          </div>

          {/* Risikoklasse + Kategorie */}
          <div className="grid grid-cols-2 gap-3 py-2 border-t border-white/10">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Typ</p>
              <p className="text-sm font-bold text-white mt-0.5 capitalize">{signal.risk_class}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Kategorie</p>
              <p className="text-sm font-bold text-white mt-0.5">{signal.category}</p>
            </div>
          </div>

          {/* Begründung Toggle */}
          <div className="pt-2 border-t border-white/10">
            <button
              onClick={(e) => { e.stopPropagation(); setShowReasoning(!showReasoning); }}
              className="text-[13px] font-medium text-white/55 transition-colors hover:text-white/80"
            >
              {showReasoning ? "Begründung ausblenden" : "Begründung anzeigen"}
            </button>
            {showReasoning && (
              <p className="text-sm text-white/60 leading-relaxed mt-2">{signal.reasoning}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared Components ───────────────────────── */

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="text-xs text-text-muted mt-1 max-w-[220px]">{subtitle}</p>
    </div>
  );
}

/* ── Offener Trade (mit Close-Flow) ──────────── */

function OpenTradeRow({ trade, onClose }: { trade: OpenTradeWithSignal; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<{ exitPrice: number; pnl: number; pnlPercent: number } | null>(null);

  const openDate = new Date(trade.openedAt).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  async function handleClose() {
    try {
      setClosing(true);
      const res = await fetch(`/api/price?ticker=${encodeURIComponent(trade.ticker)}`);
      if (!res.ok) throw new Error("Kurs nicht verfügbar");
      const { price } = await res.json();

      const leverage = parseFloat(trade.leverage) || 1;
      const spreadCost = (SPREAD_PERCENT[trade.category] || 0.05) * leverage;
      const priceDiff = trade.direction === "LONG"
        ? price - trade.entry
        : trade.entry - price;
      const pnlPercent = (priceDiff / trade.entry) * 100 * leverage - spreadCost;
      const pnl = Math.round(trade.budget * (pnlPercent / 100) * 100) / 100;

      setCloseResult({ exitPrice: price, pnl, pnlPercent: Math.round(pnlPercent * 100) / 100 });
    } catch (err) {
      console.error("Kurs laden fehlgeschlagen:", err);
    } finally {
      setClosing(false);
    }
  }

  async function handleConfirmClose() {
    if (!closeResult) return;
    try {
      await closeTrade(trade.id, closeResult.exitPrice, closeResult.pnl);
      onClose();
    } catch (err) {
      console.error("Position schließen fehlgeschlagen:", err);
    }
  }

  return (
    <div className="rounded-[12px] bg-[#1A1A1A] overflow-hidden border border-amber-500/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            trade.direction === "LONG"
              ? "bg-green-500/15 text-green-400"
              : "bg-red-500/15 text-red-400"
          }`}>
            {trade.direction === "LONG" ? "↑" : "↓"}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">{trade.asset}</p>
            <p className="text-xs text-white/55">
              {openDate} · {trade.leverage} · {trade.budget.toFixed(0)}€
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-block rounded-full bg-amber-500/15 text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
            Offen
          </span>
          <svg
            className={`w-4 h-4 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-white/10 pt-2">
          {/* Entry / SL / TP */}
          <div className="grid grid-cols-3 gap-3 pb-2">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Einstieg</p>
              <p className="text-sm font-bold text-white mt-0.5">{trade.entry.toLocaleString("de-DE")}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Stop-Loss</p>
              <p className="text-sm font-bold text-white mt-0.5">{trade.stopLoss.toLocaleString("de-DE")}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Take-Profit</p>
              <p className="text-sm font-bold text-white mt-0.5">{trade.takeProfit.toLocaleString("de-DE")}</p>
            </div>
          </div>

          {/* Close Result Preview */}
          {closeResult && (
            <div className="grid grid-cols-2 gap-3 py-2 border-t border-white/10">
              <div>
                <p className="text-[13px] text-white/55 uppercase">Aktueller Kurs</p>
                <p className="text-sm font-bold text-white mt-0.5">{closeResult.exitPrice.toLocaleString("de-DE")}</p>
              </div>
              <div>
                <p className="text-[13px] text-white/55 uppercase">Ergebnis</p>
                <p className={`text-sm font-bold mt-0.5 ${closeResult.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {closeResult.pnl >= 0 ? "+" : ""}{closeResult.pnl.toFixed(2)}€ ({closeResult.pnlPercent >= 0 ? "+" : ""}{closeResult.pnlPercent.toFixed(1)}%)
                </p>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="pt-2 border-t border-white/10">
            {!closeResult ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                disabled={closing}
                className="w-full rounded-[6px] bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {closing ? "Kurs wird geladen…" : "Jetzt schließen"}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setCloseResult(null); }}
                  className="flex-1 rounded-[6px] border border-white/20 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  Abbrechen
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleConfirmClose(); }}
                  className={`flex-1 rounded-[6px] px-4 py-2.5 text-sm font-bold text-white transition-colors ${
                    closeResult.pnl >= 0
                      ? "bg-green-600 hover:bg-green-500"
                      : "bg-red-600 hover:bg-red-500"
                  }`}
                >
                  Schließen ({closeResult.pnl >= 0 ? "+" : ""}{closeResult.pnl.toFixed(2)}€)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = trade.status === "open";
  const isClosed = trade.status === "closed";
  const isPositive = (trade.result || 0) >= 0;
  const pnl = trade.result || 0;
  const pnlPercent = trade.budget > 0 ? Math.round((pnl / trade.budget) * 100 * 100) / 100 : 0;
  const endValue = trade.budget + pnl;

  const openDate = new Date(trade.openedAt).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const closeDate = trade.closedAt
    ? new Date(trade.closedAt).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "–";

  return (
    <div className="rounded-[12px] bg-[#1A1A1A] overflow-hidden">
      <button
        onClick={() => isClosed && setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            trade.direction === "LONG"
              ? "bg-green-500/15 text-green-400"
              : "bg-red-500/15 text-red-400"
          }`}>
            {trade.direction === "LONG" ? "↑" : "↓"}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">{trade.asset}</p>
            <p className="text-xs text-white/55">
              {openDate} · {trade.leverage} · {trade.budget.toFixed(0)}€
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? (
            <span className="inline-block rounded-full bg-amber-500/15 text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
              Offen
            </span>
          ) : (
            <p className={`text-sm font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{pnl.toFixed(2)}€
            </p>
          )}
          {isClosed && (
            <svg
              className={`w-4 h-4 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && isClosed && (
        <div className="px-4 pb-2 border-t border-white/10 pt-3">
          {/* Entry → Exit */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Einstieg</p>
              <p className="text-sm font-bold text-white mt-0.5">{trade.entry.toLocaleString("de-DE")}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Ausstieg</p>
              <p className="text-sm font-bold text-white mt-0.5">{trade.exitPrice ? trade.exitPrice.toLocaleString("de-DE") : "–"}</p>
            </div>
          </div>

          {/* Einsatz → Endwert */}
          <div className="grid grid-cols-2 gap-3 py-2 border-t border-white/10">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Einsatz</p>
              <p className="text-sm font-bold text-white mt-0.5">{trade.budget.toFixed(0)}€</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Endwert</p>
              <p className={`text-sm font-bold mt-0.5 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                {endValue.toFixed(2)}€
              </p>
            </div>
          </div>

          {/* P&L */}
          <div className="grid grid-cols-2 gap-3 py-2 border-t border-white/10">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Ergebnis</p>
              <p className={`text-sm font-bold mt-0.5 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                {isPositive ? "+" : ""}{pnl.toFixed(2)}€
              </p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Rendite</p>
              <p className={`text-sm font-bold mt-0.5 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Zeitstempel */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Eröffnet</p>
              <p className="text-sm font-semibold text-white mt-0.5">{openDate}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Geschlossen</p>
              <p className="text-sm font-semibold text-white mt-0.5">{closeDate}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
