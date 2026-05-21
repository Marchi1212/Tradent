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

  const isBold = signal.riskClass === "bold";
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

  // Color scheme based on risk class
  const colors = isBold
    ? {
        bg: "bg-[#1A1A1A]",
        text: "text-white",
        textSecondary: "text-white/60",
        textMuted: "text-white/40",
        border: "border-white/10",
        dot: marketStatus.dot,
        inputBg: "bg-white/10",
        inputBorder: "border-white/15",
        inputFocus: "focus:border-white/30",
        btnBg: "bg-white",
        btnText: "text-[#1A1A1A]",
        btnHover: "hover:bg-white/90",
        btnOutline: "bg-transparent border border-white/20 text-white hover:border-white/40",
        positive: "text-[#34D399]",
        negative: "text-[#F87171]",
      }
    : {
        bg: "bg-bg-card",
        text: "text-text-primary",
        textSecondary: "text-text-secondary",
        textMuted: "text-text-muted",
        border: "border-border",
        dot: marketStatus.dot,
        inputBg: "bg-bg-primary",
        inputBorder: "border-border",
        inputFocus: "focus:border-text-muted",
        btnBg: "bg-accent",
        btnText: "text-white",
        btnHover: "hover:bg-accent-hover",
        btnOutline: "bg-transparent border border-border text-text-primary hover:border-border-hover",
        positive: "text-positive",
        negative: "text-negative",
      };

  return (
    <div className={`rounded-[--radius-lg] ${colors.bg} overflow-hidden`}>
      {/* Collapsed View */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-5 text-left"
      >
        {/* Top: Asset + Direction + Confidence */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className={`text-xl font-bold ${colors.text}`}>
              {signal.asset}
            </h3>
            <p className={`text-sm ${colors.textSecondary} mt-1`}>
              {signal.direction} · {signal.category} · {signal.leverage}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-black ${colors.text}`}>
              {signal.confidence}%
            </p>
          </div>
        </div>

        {/* Bottom: Expected Gain + Market Status + Chevron */}
        <div className="flex items-center justify-between mt-5">
          <div className="flex items-center gap-4">
            <span className={`text-sm font-semibold ${colors.positive}`}>
              +{signal.expectedGainPercent}%
            </span>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              <span className={`text-xs ${colors.textMuted}`}>
                {marketStatus.text}
              </span>
            </div>
          </div>
          <svg
            className={`w-5 h-5 ${colors.textMuted} transition-transform ${expanded ? "rotate-180" : ""}`}
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
        <div className={`px-5 pb-5 space-y-4 border-t ${colors.border} pt-4`}>
          {/* Entry / SL / TP */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className={`text-[11px] ${colors.textMuted} uppercase`}>Einstieg</p>
              <p className={`text-base font-bold ${colors.text} mt-1`}>
                {signal.entry.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className={`text-[11px] ${colors.textMuted} uppercase`}>Stop-Loss</p>
              <p className={`text-base font-bold ${colors.negative} mt-1`}>
                {signal.stopLoss.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className={`text-[11px] ${colors.textMuted} uppercase`}>Take-Profit</p>
              <p className={`text-base font-bold ${colors.positive} mt-1`}>
                {signal.takeProfit.toLocaleString("de-DE")}
              </p>
            </div>
          </div>

          {/* Timing */}
          <div className={`grid grid-cols-2 gap-3 pt-4 border-t ${colors.border}`}>
            <div>
              <p className={`text-[11px] ${colors.textMuted} uppercase`}>Bester Einstieg</p>
              <p className={`text-sm font-semibold ${colors.text} mt-1`}>{signal.optimalEntry}</p>
            </div>
            <div>
              <p className={`text-[11px] ${colors.textMuted} uppercase`}>Markt schließt</p>
              <p className={`text-sm font-semibold ${colors.text} mt-1`}>{signal.marketCloseTime}</p>
            </div>
          </div>

          {/* Reasoning */}
          <div className={`pt-4 border-t ${colors.border}`}>
            <p className={`text-[11px] ${colors.textMuted} uppercase mb-2`}>Begründung</p>
            <p className={`text-sm ${colors.textSecondary} leading-relaxed`}>
              {signal.reasoning}
            </p>
          </div>

          {/* Risk */}
          <div className={`pt-4 border-t ${colors.border}`}>
            <p className={`text-sm ${colors.textSecondary}`}>
              Chance/Risiko {signal.riskRewardRatio} · Max. Verlust{" "}
              <span className={`font-semibold ${colors.negative}`}>{maxLossPercent.toFixed(1)}%</span>
            </p>
          </div>

          {/* Position eröffnen */}
          {!positionOpened ? (
            <div className={`pt-4 border-t ${colors.border}`}>
              {!showBudget ? (
                <button
                  onClick={() => setShowBudget(true)}
                  className={`w-full rounded-[--radius-md] ${colors.btnBg} py-3.5 text-sm font-bold ${colors.btnText} transition-colors ${colors.btnHover}`}
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
                      className={`flex-1 rounded-[--radius-md] ${colors.inputBg} border ${colors.inputBorder} px-4 py-3 text-sm ${colors.text} placeholder:${colors.textMuted} outline-none transition-colors ${colors.inputFocus}`}
                      autoFocus
                    />
                    <button
                      onClick={handleOpenPosition}
                      disabled={budgetNum <= 0}
                      className={`rounded-[--radius-md] ${colors.btnBg} px-6 py-3 text-sm font-bold ${colors.btnText} transition-colors ${colors.btnHover} disabled:opacity-30`}
                    >
                      OK
                    </button>
                  </div>
                  {budgetNum > 0 && (
                    <div className={`flex justify-between text-sm ${colors.textSecondary}`}>
                      <span>
                        Gewinn: <span className={`font-semibold ${colors.positive}`}>+{expectedGainEuro}€</span>
                      </span>
                      <span>
                        Verlust: <span className={`font-semibold ${colors.negative}`}>-{maxLossEuro}€</span>
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => { setShowBudget(false); setBudget(""); }}
                    className={`w-full text-sm ${colors.textMuted}`}
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`pt-4 border-t ${colors.border} space-y-3`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${colors.text}`}>
                  Position aktiv
                </span>
                <span className={`text-sm ${colors.textSecondary}`}>
                  {parseFloat(budget).toFixed(2)}€
                </span>
              </div>
              <button className={`w-full rounded-[--radius-md] py-3.5 text-sm font-bold transition-colors ${colors.btnOutline}`}>
                Position schließen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
