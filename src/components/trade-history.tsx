"use client";

import { useState, useEffect } from "react";
import type { Trade } from "@/lib/portfolio-store";
import { getTrades } from "@/lib/portfolio-store";

interface Props {
  portfolioId: string;
}

export default function TradeHistory({ portfolioId }: Props) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTrades(portfolioId)
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [portfolioId]);

  if (!loaded) return null;

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-text-primary">Noch keine Trades</p>
        <p className="text-xs text-text-muted mt-1">
          Öffne eine Position bei einem Signal um zu starten.
        </p>
      </div>
    );
  }

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");

  const totalResult = closedTrades.reduce((sum, t) => sum + (t.result || 0), 0);

  return (
    <div className="space-y-6">
      {/* Zusammenfassung */}
      {closedTrades.length > 0 && (
        <div className="rounded-[--radius-md] bg-bg-secondary p-4">
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

function TradeRow({ trade }: { trade: Trade }) {
  const isOpen = trade.status === "open";
  const isPositive = (trade.result || 0) >= 0;

  const date = new Date(trade.openedAt).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="rounded-[--radius-md] bg-bg-card px-4 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Direction Badge */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
          trade.direction === "LONG"
            ? "bg-positive/10 text-positive"
            : "bg-negative/10 text-negative"
        }`}>
          {trade.direction === "LONG" ? "↑" : "↓"}
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary">{trade.asset}</p>
          <p className="text-xs text-text-muted">
            {date} · {trade.leverage} · {trade.budget.toFixed(0)}€
          </p>
        </div>
      </div>

      <div className="text-right">
        {isOpen ? (
          <span className="inline-block rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-xs font-semibold">
            Offen
          </span>
        ) : (
          <p className={`text-sm font-bold ${isPositive ? "text-positive" : "text-negative"}`}>
            {isPositive ? "+" : ""}{(trade.result || 0).toFixed(2)}€
          </p>
        )}
      </div>
    </div>
  );
}
