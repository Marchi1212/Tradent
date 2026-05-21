"use client";

import { useState } from "react";
import type { Signal } from "@/lib/mock-signals";

function getMarketStatusLabel(status: Signal["marketStatus"]) {
  switch (status) {
    case "open":
      return { text: "Markt offen", dot: "bg-positive" };
    case "opening-soon":
      return { text: "Öffnet bald", dot: "bg-warning" };
    case "closed":
      return { text: "Geschlossen", dot: "bg-text-muted" };
  }
}

export default function SignalCard({ signal }: { signal: Signal }) {
  const [expanded, setExpanded] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budget, setBudget] = useState("");
  const [positionOpened, setPositionOpened] = useState(false);

  const marketStatus = getMarketStatusLabel(signal.marketStatus);
  const budgetNum = parseFloat(budget) || 0;
  const expectedGainEuro = ((budgetNum * signal.expectedGainPercent) / 100).toFixed(2);
  const maxLossPercent =
    signal.direction === "LONG"
      ? ((signal.entry - signal.stopLoss) / signal.entry) * parseFloat(signal.leverage) * 100
      : ((signal.stopLoss - signal.entry) / signal.entry) * parseFloat(signal.leverage) * 100;
  const maxLossEuro = ((budgetNum * maxLossPercent) / 100).toFixed(2);

  function handleOpenPosition() {
    if (!budget || budgetNum <= 0) return;
    setPositionOpened(true);
    setShowBudget(false);
  }

  return (
    <div className="rounded-[--radius-lg] bg-bg-card overflow-hidden">
      {/* Collapsed View */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-5 text-left"
      >
        {/* Label Row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            {signal.riskClass === "steady" ? "Steady" : "Bold"}
          </span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${marketStatus.dot}`} />
            <span className="text-[11px] text-text-muted">
              {marketStatus.text}
            </span>
          </div>
        </div>

        {/* Asset Row */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {signal.asset}
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">
              {signal.category} · {signal.direction} · Hebel {signal.leverage}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-text-primary">
              {signal.confidence}%
            </p>
            <p className="text-[11px] text-text-muted">Konfidenz</p>
          </div>
        </div>

        {/* Expected Gain */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-[11px] text-text-muted uppercase">Erwarteter Gewinn</p>
            <p className="text-sm text-text-primary mt-0.5">
              <span className="text-positive font-semibold">+{signal.expectedGainPercent}%</span>
              <span className="text-text-muted"> · bei 50€ → </span>
              <span className="font-semibold">+{((50 * signal.expectedGainPercent) / 100).toFixed(2)}€</span>
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded View */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Entry / SL / TP */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-text-muted uppercase">Einstieg</p>
              <p className="text-base font-semibold text-text-primary mt-1">
                {signal.entry.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase">Stop-Loss</p>
              <p className="text-base font-semibold text-negative mt-1">
                {signal.stopLoss.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase">Take-Profit</p>
              <p className="text-base font-semibold text-positive mt-1">
                {signal.takeProfit.toLocaleString("de-DE")}
              </p>
            </div>
          </div>

          {/* Timing */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            <div>
              <p className="text-[11px] text-text-muted uppercase">Bester Einstieg</p>
              <p className="text-sm text-text-primary mt-1">{signal.optimalEntry}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase">Markt schließt</p>
              <p className="text-sm text-text-primary mt-1">{signal.marketCloseTime}</p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="pt-4 border-t border-border">
            <p className="text-[11px] text-text-muted uppercase mb-2">Begründung</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              {signal.reasoning}
            </p>
          </div>

          {/* Risk Info */}
          <div className="pt-4 border-t border-border">
            <p className="text-[11px] text-text-muted uppercase mb-1">Risiko</p>
            <p className="text-sm text-text-secondary">
              Chance/Risiko {signal.riskRewardRatio} · Max. Verlust{" "}
              <span className="text-negative">{maxLossPercent.toFixed(1)}%</span>
            </p>
          </div>

          {/* Position eröffnen */}
          {!positionOpened ? (
            <div className="pt-4 border-t border-border">
              {!showBudget ? (
                <button
                  onClick={() => setShowBudget(true)}
                  className="w-full rounded-[--radius-md] bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  Position eröffnen
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="Budget in €"
                      className="flex-1 rounded-[--radius-md] bg-bg-primary border border-border px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-text-muted"
                      autoFocus
                    />
                    <button
                      onClick={handleOpenPosition}
                      disabled={budgetNum <= 0}
                      className="rounded-[--radius-md] bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-30"
                    >
                      Bestätigen
                    </button>
                  </div>
                  {budgetNum > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">
                        Gewinn: <span className="text-positive font-medium">+{expectedGainEuro}€</span>
                      </span>
                      <span className="text-text-secondary">
                        Verlust: <span className="text-negative font-medium">-{maxLossEuro}€</span>
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => { setShowBudget(false); setBudget(""); }}
                    className="w-full text-sm text-text-muted hover:text-text-secondary"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">
                  Position aktiv
                </span>
                <span className="text-sm text-text-secondary">
                  {parseFloat(budget).toFixed(2)}€
                </span>
              </div>
              <button className="w-full rounded-[--radius-md] bg-bg-primary border border-border py-3.5 text-sm font-semibold text-text-primary transition-colors hover:border-border-hover">
                Position schließen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
