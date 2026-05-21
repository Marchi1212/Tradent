"use client";

import { useState, useEffect } from "react";
import type { Signal } from "@/lib/mock-signals";
import { getMarketInfo, formatTimer } from "@/lib/market-hours";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SignalCard({ signal }: { signal: Signal }) {
  const [expanded, setExpanded] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budget, setBudget] = useState("");
  const [positionOpened, setPositionOpened] = useState(false);
  const [marketInfo, setMarketInfo] = useState(getMarketInfo(signal.market));

  // Live timer update every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketInfo(getMarketInfo(signal.market));
    }, 30000);
    return () => clearInterval(interval);
  }, [signal.market]);

  const isBold = signal.riskClass === "bold";
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

  const c = isBold
    ? {
        bg: "bg-[#1A1A1A]",
        text: "text-white",
        textSec: "text-white/60",
        textMut: "text-white/40",
        border: "border-white/10",
        inputBg: "bg-white/10",
        inputBorder: "border-white/15",
        inputFocus: "focus:border-white/30",
        btnBg: "bg-white",
        btnText: "text-[#1A1A1A]",
        btnHover: "hover:bg-white/90",
        btnOutline: "border border-white/20 text-white hover:border-white/40",
        pos: "text-[#34D399]",
        neg: "text-[#F87171]",
        timerText: marketInfo.canStillEnter ? "text-[#34D399]" : "text-white/50",
      }
    : {
        bg: "bg-bg-card",
        text: "text-text-primary",
        textSec: "text-text-secondary",
        textMut: "text-text-muted",
        border: "border-border",
        inputBg: "bg-bg-primary",
        inputBorder: "border-border",
        inputFocus: "focus:border-text-muted",
        btnBg: "bg-accent",
        btnText: "text-white",
        btnHover: "hover:bg-accent-hover",
        btnOutline: "border border-border text-text-primary hover:border-border-hover",
        pos: "text-positive",
        neg: "text-negative",
        timerText: marketInfo.canStillEnter ? "text-positive" : "text-text-muted",
      };

  return (
    <div className={`rounded-[--radius-lg] ${c.bg} overflow-hidden`}>
      {/* Collapsed View */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-5 text-left"
      >
        {/* Timer Row */}
        <div className="flex items-center gap-1.5 mb-3">
          <ClockIcon className={`w-3.5 h-3.5 ${c.timerText}`} />
          <span className={`text-xs font-medium ${c.timerText}`}>
            {marketInfo.timerSeconds !== null
              ? `${marketInfo.timerLabel} ${formatTimer(marketInfo.timerSeconds)}`
              : marketInfo.timerLabel}
          </span>
        </div>

        {/* Asset + Confidence */}
        <div className="flex items-start justify-between">
          <h3 className={`text-2xl font-black ${c.text}`}>
            {signal.asset}
          </h3>
          <div className="text-right">
            <p className={`text-2xl font-black ${c.text}`}>
              {signal.confidence}%
            </p>
            <p className={`text-[11px] ${c.textMut}`}>Konfidenz</p>
          </div>
        </div>

        {/* Meta Row */}
        <p className={`text-sm ${c.textSec} mt-1`}>
          {signal.direction} · {signal.category} · {signal.leverage}
        </p>

        {/* Expected Gain + Chevron */}
        <div className="flex items-center justify-between mt-5">
          <p className={`text-sm ${c.textSec}`}>
            Erw. Gewinn{" "}
            <span className={`font-bold ${c.pos}`}>+{signal.expectedGainPercent}%</span>
            <span className={c.textMut}> · 50€ → </span>
            <span className={`font-bold ${c.text}`}>+{((50 * signal.expectedGainPercent) / 100).toFixed(2)}€</span>
          </p>
          <svg
            className={`w-5 h-5 ${c.textMut} transition-transform ${expanded ? "rotate-180" : ""}`}
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
        <div className={`px-5 pb-5 space-y-4 border-t ${c.border} pt-4`}>
          {/* Entry / SL / TP */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className={`text-[11px] ${c.textMut} uppercase`}>Einstieg</p>
              <p className={`text-base font-bold ${c.text} mt-1`}>
                {signal.entry.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className={`text-[11px] ${c.textMut} uppercase`}>Stop-Loss</p>
              <p className={`text-base font-bold ${c.neg} mt-1`}>
                {signal.stopLoss.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className={`text-[11px] ${c.textMut} uppercase`}>Take-Profit</p>
              <p className={`text-base font-bold ${c.pos} mt-1`}>
                {signal.takeProfit.toLocaleString("de-DE")}
              </p>
            </div>
          </div>

          {/* Timing */}
          <div className={`grid grid-cols-2 gap-3 pt-4 border-t ${c.border}`}>
            <div>
              <p className={`text-[11px] ${c.textMut} uppercase`}>Bester Einstieg</p>
              <p className={`text-sm font-semibold ${c.text} mt-1`}>{signal.optimalEntry}</p>
            </div>
            <div>
              <p className={`text-[11px] ${c.textMut} uppercase`}>Markt schließt</p>
              <p className={`text-sm font-semibold ${c.text} mt-1`}>{signal.marketCloseTime}</p>
            </div>
          </div>

          {/* Reasoning */}
          <div className={`pt-4 border-t ${c.border}`}>
            <p className={`text-[11px] ${c.textMut} uppercase mb-2`}>Begründung</p>
            <p className={`text-sm ${c.textSec} leading-relaxed`}>
              {signal.reasoning}
            </p>
          </div>

          {/* Risk */}
          <div className={`pt-4 border-t ${c.border}`}>
            <p className={`text-sm ${c.textSec}`}>
              Chance/Risiko {signal.riskRewardRatio} · Max. Verlust{" "}
              <span className={`font-bold ${c.neg}`}>{maxLossPercent.toFixed(1)}%</span>
            </p>
          </div>

          {/* Position eröffnen */}
          {!positionOpened ? (
            <div className={`pt-4 border-t ${c.border}`}>
              {!showBudget ? (
                <button
                  onClick={() => setShowBudget(true)}
                  className={`w-full rounded-[--radius-md] ${c.btnBg} py-3.5 text-sm font-bold ${c.btnText} transition-colors ${c.btnHover}`}
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
                      className={`flex-1 rounded-[--radius-md] ${c.inputBg} border ${c.inputBorder} px-4 py-3 text-sm ${c.text} outline-none transition-colors ${c.inputFocus}`}
                      autoFocus
                    />
                    <button
                      onClick={handleOpenPosition}
                      disabled={budgetNum <= 0}
                      className={`rounded-[--radius-md] ${c.btnBg} px-6 py-3 text-sm font-bold ${c.btnText} transition-colors ${c.btnHover} disabled:opacity-30`}
                    >
                      OK
                    </button>
                  </div>
                  {budgetNum > 0 && (
                    <div className={`flex justify-between text-sm ${c.textSec}`}>
                      <span>Gewinn: <span className={`font-bold ${c.pos}`}>+{expectedGainEuro}€</span></span>
                      <span>Verlust: <span className={`font-bold ${c.neg}`}>-{maxLossEuro}€</span></span>
                    </div>
                  )}
                  <button
                    onClick={() => { setShowBudget(false); setBudget(""); }}
                    className={`w-full text-sm ${c.textMut}`}
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`pt-4 border-t ${c.border} space-y-3`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${c.text}`}>Position aktiv</span>
                <span className={`text-sm ${c.textSec}`}>{parseFloat(budget).toFixed(2)}€</span>
              </div>
              <button className={`w-full rounded-[--radius-md] py-3.5 text-sm font-bold transition-colors ${c.btnOutline}`}>
                Position schließen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
