"use client";

import { useState } from "react";
import type { Signal } from "@/lib/mock-signals";

function getMarketStatusLabel(status: Signal["marketStatus"]) {
  switch (status) {
    case "open":
      return { text: "Markt offen", color: "text-positive", dot: "bg-positive" };
    case "opening-soon":
      return { text: "Öffnet bald", color: "text-warning", dot: "bg-warning" };
    case "closed":
      return { text: "Geschlossen", color: "text-text-muted", dot: "bg-text-muted" };
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 80) return "text-positive";
  if (confidence >= 65) return "text-warning";
  return "text-negative";
}

function getConfidenceBarColor(confidence: number) {
  if (confidence >= 80) return "bg-positive";
  if (confidence >= 65) return "bg-warning";
  return "bg-negative";
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
    <div className="rounded-[--radius-lg] bg-bg-card border border-border overflow-hidden">
      {/* Collapsed View – immer sichtbar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
      >
        {/* Top Row: Risk Class + Market Status */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              signal.riskClass === "steady"
                ? "bg-accent/15 text-accent"
                : "bg-warning/15 text-warning"
            }`}
          >
            {signal.riskClass === "steady" ? "Steady" : "Bold"}
          </span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${marketStatus.dot}`} />
            <span className={`text-[11px] ${marketStatus.color}`}>
              {marketStatus.text}
            </span>
          </div>
        </div>

        {/* Main Row: Asset Info + Confidence + Expected Gain */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-bg-elevated flex items-center justify-center text-sm font-bold text-text-primary shrink-0">
            {signal.ticker.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-text-primary truncate">
                {signal.asset}
              </p>
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  signal.direction === "LONG"
                    ? "bg-positive/15 text-positive"
                    : "bg-negative/15 text-negative"
                }`}
              >
                {signal.direction}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              {signal.category} · Hebel {signal.leverage}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-bold ${getConfidenceColor(signal.confidence)}`}>
              {signal.confidence}%
            </p>
            <p className="text-[11px] text-text-muted">Konfidenz</p>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="mt-3 w-full h-1 rounded-full bg-bg-elevated overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getConfidenceBarColor(signal.confidence)}`}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>

        {/* Expected Gain + Chevron */}
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-text-secondary">
            Erwarteter Gewinn:{" "}
            <span className="text-positive font-semibold">
              +{signal.expectedGainPercent}%
            </span>
            <span className="text-text-muted"> bei 50€ → </span>
            <span className="text-positive font-semibold">
              +{((50 * signal.expectedGainPercent) / 100).toFixed(2)}€
            </span>
          </p>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded View – Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Entry / SL / TP */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">Einstieg</p>
              <p className="text-sm font-semibold text-text-primary mt-0.5">
                {signal.entry.toLocaleString("de-DE")}
              </p>
            </div>
            <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">Stop-Loss</p>
              <p className="text-sm font-semibold text-negative mt-0.5">
                {signal.stopLoss.toLocaleString("de-DE")}
              </p>
            </div>
            <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">Take-Profit</p>
              <p className="text-sm font-semibold text-positive mt-0.5">
                {signal.takeProfit.toLocaleString("de-DE")}
              </p>
            </div>
          </div>

          {/* Timing Info */}
          <div className="flex gap-2">
            <div className="flex-1 rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">Bester Einstieg</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">
                {signal.optimalEntry}
              </p>
            </div>
            <div className="flex-1 rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">Markt schließt</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">
                {signal.marketCloseTime}
              </p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
            <p className="text-[10px] text-text-muted uppercase mb-1">
              Begründung
            </p>
            <p className="text-xs text-text-secondary leading-relaxed">
              {signal.reasoning}
            </p>
          </div>

          {/* Risk/Reward Info */}
          <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
            <p className="text-[10px] text-text-muted uppercase mb-1">
              Risiko / Chance
            </p>
            <p className="text-xs text-text-secondary">
              Verhältnis {signal.riskRewardRatio} · Max. Verlust:{" "}
              <span className="text-negative font-medium">
                -{maxLossPercent.toFixed(1)}%
              </span>
              {" "}· Hebel: {signal.leverage}
            </p>
          </div>

          {/* Position eröffnen */}
          {!positionOpened ? (
            <>
              {!showBudget ? (
                <button
                  onClick={() => setShowBudget(true)}
                  className="w-full rounded-[--radius-md] bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-active"
                >
                  Position eröffnen
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="Budget in €"
                        className="w-full rounded-[--radius-sm] bg-bg-elevated border border-border px-3 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleOpenPosition}
                      disabled={budgetNum <= 0}
                      className="rounded-[--radius-sm] bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
                    >
                      Bestätigen
                    </button>
                  </div>
                  {budgetNum > 0 && (
                    <div className="flex justify-between text-xs px-1">
                      <span className="text-text-muted">
                        Erwarteter Gewinn:{" "}
                        <span className="text-positive font-medium">
                          +{expectedGainEuro}€
                        </span>
                      </span>
                      <span className="text-text-muted">
                        Max. Verlust:{" "}
                        <span className="text-negative font-medium">
                          -{maxLossEuro}€
                        </span>
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowBudget(false);
                      setBudget("");
                    }}
                    className="w-full text-xs text-text-muted hover:text-text-secondary"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[--radius-md] bg-accent/10 border border-accent/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-accent">
                  Position aktiv
                </span>
                <span className="text-xs text-text-secondary">
                  Budget: {parseFloat(budget).toFixed(2)}€
                </span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-[--radius-sm] bg-positive/15 border border-positive/30 py-2.5 text-xs font-semibold text-positive transition-colors hover:bg-positive/25">
                  Position schließen
                </button>
                <button className="flex-1 rounded-[--radius-sm] bg-bg-elevated border border-border py-2.5 text-xs font-medium text-text-muted transition-colors hover:text-text-secondary hover:border-border-hover">
                  Glattstellung
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
