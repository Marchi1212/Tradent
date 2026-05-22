"use client";

import { useState, useEffect } from "react";
import type { Signal } from "@/lib/mock-signals";
import type { Portfolio } from "@/lib/portfolio-store";
import { calculatePositionSize } from "@/lib/portfolio-store";
import { getMarketInfo, formatTimer } from "@/lib/market-hours";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SignalCard({
  signal,
  portfolio,
}: {
  signal: Signal;
  portfolio: Portfolio | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [positionOpened, setPositionOpened] = useState(false);
  const [marketInfo, setMarketInfo] = useState(getMarketInfo(signal.market));

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketInfo(getMarketInfo(signal.market));
    }, 30000);
    return () => clearInterval(interval);
  }, [signal.market]);

  const isBold = signal.riskClass === "bold";
  const hasPortfolio = portfolio !== null;

  // Position sizing nur mit Portfolio
  const riskPercent = hasPortfolio ? (isBold ? portfolio.riskBold : portfolio.riskSteady) : 0;
  const slPercent =
    signal.direction === "LONG"
      ? ((signal.entry - signal.stopLoss) / signal.entry) * 100
      : ((signal.stopLoss - signal.entry) / signal.entry) * 100;
  const leverage = parseFloat(signal.leverage);

  const recommendedBudget = hasPortfolio
    ? calculatePositionSize(portfolio.currentBalance, riskPercent, slPercent, leverage)
    : 0;
  const maxLoss = hasPortfolio ? portfolio.currentBalance * (riskPercent / 100) : 0;
  const expectedGainEuro = (recommendedBudget * signal.expectedGainPercent / 100).toFixed(2);

  async function handleOpenPosition() {
    if (!portfolio) return;
    try {
      const { addTrade } = await import("@/lib/portfolio-store");
      await addTrade({
        portfolioId: portfolio.id,
        signalId: signal.id,
        asset: signal.asset,
        direction: signal.direction,
        entry: signal.entry,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        leverage: signal.leverage,
        budget: recommendedBudget,
        status: "open",
      });
      setPositionOpened(true);
    } catch (err) {
      console.error("Trade öffnen fehlgeschlagen:", err);
    }
  }

  // Farb-Schema: Steady = hell, Bold = invertiert
  const c = isBold
    ? {
        bg: "bg-[#1A1A1A]",
        text: "text-white",
        textSec: "text-white/60",
        textMut: "text-white/40",
        border: "border-white/10",
        btnBg: "bg-white",
        btnText: "text-[#1A1A1A]",
        btnHover: "hover:bg-white/90",
        btnOutline: "border border-white/20 text-white hover:border-white/40",
        timerText: "text-white/50",
        badge: "bg-white/10 text-white/70",
      }
    : {
        bg: "bg-bg-card",
        text: "text-text-primary",
        textSec: "text-text-secondary",
        textMut: "text-text-muted",
        border: "border-border",
        btnBg: "bg-accent",
        btnText: "text-white",
        btnHover: "hover:bg-accent-hover",
        btnOutline: "border border-border text-text-primary hover:border-border-hover",
        timerText: "text-text-muted",
        badge: "bg-bg-elevated text-text-muted",
      };

  return (
    <div className={`rounded-[12px] ${c.bg} overflow-hidden`}>
      {/* Collapsed View */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-5 text-left"
      >
        {/* Timer */}
        <div className="flex items-center gap-1.5 mb-4">
          <ClockIcon className={`w-3.5 h-3.5 ${c.timerText}`} />
          <span className={`text-xs font-medium ${c.timerText}`}>
            {marketInfo.timerSeconds !== null
              ? `${marketInfo.timerLabel} ${formatTimer(marketInfo.timerSeconds)}`
              : marketInfo.timerLabel}
          </span>
        </div>

        {/* Asset + Confidence */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className={`text-[32px] leading-tight font-black ${c.text}`}>{signal.asset}</h3>
            <p className={`text-xs ${c.textMut} mt-0.5`}>
              {signal.direction} · {signal.category} · {signal.leverage}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black ${c.text}`}>{signal.confidence}%</p>
            <p className={`text-[11px] ${c.textMut}`}>Konfidenz</p>
          </div>
        </div>

        {/* Expected Gain */}
        <div className="flex items-center justify-between mt-5">
          <p className={`text-sm ${c.textSec}`}>
            <span className={`font-bold ${c.text}`}>+{signal.expectedGainPercent}%</span>
            <span className={c.textMut}> · </span>
            {hasPortfolio ? (
              <>
                <span className={`font-bold ${c.text}`}>+{expectedGainEuro}€</span>
                <span className={c.textMut}> bei {recommendedBudget.toFixed(0)}€</span>
              </>
            ) : (
              <>
                <span className={`font-bold ${c.text}`}>+{(200 * signal.expectedGainPercent / 100).toFixed(0)}€</span>
                <span className={c.textMut}> bei 200€</span>
              </>
            )}
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
              <p className={`text-base font-bold ${c.text} mt-1`}>
                {signal.stopLoss.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className={`text-[11px] ${c.textMut} uppercase`}>Take-Profit</p>
              <p className={`text-base font-bold ${c.text} mt-1`}>
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
            <p className={`text-sm ${c.textSec} leading-relaxed`}>{signal.reasoning}</p>
          </div>

          {/* Risk + Budget Info */}
          <div className={`pt-4 border-t ${c.border} space-y-1`}>
            <div className="flex justify-between text-sm">
              <span className={c.textSec}>Empfohlener Einsatz</span>
              <span className={`font-bold ${c.text}`}>{recommendedBudget.toFixed(0)}€</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={c.textSec}>Max. Verlust ({riskPercent}%)</span>
              <span className={`font-bold ${c.text}`}>-{maxLoss.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={c.textSec}>Erwarteter Gewinn</span>
              <span className={`font-bold ${c.text}`}>+{expectedGainEuro}€</span>
            </div>
          </div>

          {/* Position eröffnen – nur mit Portfolio */}
          {hasPortfolio && (
            <>
              {!positionOpened ? (
                <div className={`pt-4 border-t ${c.border}`}>
                  <button
                    onClick={handleOpenPosition}
                    className={`w-full rounded-[6px] ${c.btnBg} py-3.5 text-sm font-bold ${c.btnText} transition-colors ${c.btnHover}`}
                  >
                    Position eröffnen · {recommendedBudget.toFixed(0)}€
                  </button>
                </div>
              ) : (
                <div className={`pt-4 border-t ${c.border} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${c.text}`}>Position aktiv</span>
                    <span className={`text-sm ${c.textSec}`}>{recommendedBudget.toFixed(0)}€</span>
                  </div>
                  <button
                    className={`w-full rounded-[6px] py-3.5 text-sm font-bold transition-colors ${c.btnOutline}`}
                  >
                    Position schließen
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
