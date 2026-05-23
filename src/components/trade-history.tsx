"use client";

import { useState, useEffect } from "react";
import type { Trade } from "@/lib/portfolio-store";
import { getTrades } from "@/lib/portfolio-store";

type SubTab = "my-trades" | "all-signals";

interface Props {
  portfolioId: string;
}

export default function TradeHistory({ portfolioId }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("my-trades");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTrades(portfolioId)
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoaded(true));
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
        <MyTrades trades={trades} />
      ) : (
        <AllSignals />
      )}
    </div>
  );
}

/* ── Meine Trades ────────────────────────────── */

function MyTrades({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
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

  const openTrades = trades.filter((t) => t.status === "open");
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

      {/* Offene Trades */}
      {openTrades.length > 0 && (
        <div>
          <p className="text-[11px] text-text-muted uppercase font-semibold mb-3">
            Offen ({openTrades.length})
          </p>
          <div className="space-y-2">
            {openTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
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

function AllSignals() {
  return (
    <EmptyState
      icon={
        <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      }
      title="Bald verfügbar"
      subtitle="Hier siehst du bald die Performance aller Tradent-Signale – auch die, die du nicht gehandelt hast."
    />
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
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          {/* Einsatz → Endwert */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Einsatz</p>
              <p className="text-sm font-bold text-white mt-1">{trade.budget.toFixed(0)}€</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Endwert</p>
              <p className={`text-sm font-bold mt-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                {endValue.toFixed(2)}€
              </p>
            </div>
          </div>

          {/* P&L */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Ergebnis</p>
              <p className={`text-sm font-bold mt-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                {isPositive ? "+" : ""}{pnl.toFixed(2)}€
              </p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Rendite</p>
              <p className={`text-sm font-bold mt-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Zeitstempel */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
            <div>
              <p className="text-[13px] text-white/55 uppercase">Eröffnet</p>
              <p className="text-sm font-semibold text-white mt-1">{openDate}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/55 uppercase">Geschlossen</p>
              <p className="text-sm font-semibold text-white mt-1">{closeDate}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
