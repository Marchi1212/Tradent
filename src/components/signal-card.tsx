"use client";

import { useState, useEffect } from "react";
import type { Signal } from "@/lib/mock-signals";
import type { Portfolio } from "@/lib/portfolio-store";
import { getOpenTradeForSignal } from "@/lib/portfolio-store";
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
  allocatedBudget,
}: {
  signal: Signal;
  portfolio: Portfolio | null;
  allocatedBudget: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [positionOpened, setPositionOpened] = useState(false);
  const [marketInfo, setMarketInfo] = useState(getMarketInfo(signal.market));

  // Revalidierungs-State
  const [revalidating, setRevalidating] = useState(false);
  const [revalidation, setRevalidation] = useState<{
    valid: boolean;
    currentPrice: number;
    priceDiffPercent: number;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
    reason: string;
  } | null>(null);
  const [revalError, setRevalError] = useState<string | null>(null);

  // Prüfen ob schon ein offener Trade für dieses Signal existiert
  useEffect(() => {
    if (!portfolio) return;
    getOpenTradeForSignal(portfolio.id, signal.id)
      .then((trade) => {
        if (trade) setPositionOpened(true);
      })
      .catch(console.error);
  }, [portfolio, signal.id]);

  useEffect(() => {
    // Bei offener Position jede Sekunde updaten (für smooth Countdown-Balken)
    const ms = positionOpened ? 1000 : 30000;
    const interval = setInterval(() => {
      setMarketInfo(getMarketInfo(signal.market));
    }, ms);
    return () => clearInterval(interval);
  }, [signal.market, positionOpened]);

  const isBold = signal.riskClass === "bold";
  const hasPortfolio = portfolio !== null && allocatedBudget > 0;

  // Berechnungen basierend auf Kelly-Allokation vom Dashboard
  const leverage = parseFloat(signal.leverage);
  const slPercent =
    signal.direction === "LONG"
      ? ((signal.entry - signal.stopLoss) / signal.entry) * 100
      : ((signal.stopLoss - signal.entry) / signal.entry) * 100;
  const tpPercent =
    signal.direction === "LONG"
      ? ((signal.takeProfit - signal.entry) / signal.entry) * 100
      : ((signal.entry - signal.takeProfit) / signal.entry) * 100;

  const expectedGainEuro = hasPortfolio
    ? (allocatedBudget * leverage * tpPercent / 100).toFixed(2)
    : "0";
  const maxLossEuro = hasPortfolio
    ? (allocatedBudget * leverage * slPercent / 100).toFixed(2)
    : "0";

  // Beispielrechnung ohne Portfolio (200€ Beispiel)
  const exampleBudget = 200;
  const exampleGain = (exampleBudget * leverage * tpPercent / 100).toFixed(0);

  // Schritt 1: Revalidierung starten
  async function handleRevalidate() {
    if (!portfolio || allocatedBudget <= 0) return;
    try {
      setRevalidating(true);
      setRevalError(null);
      setRevalidation(null);

      const res = await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: signal.asset,
          ticker: signal.ticker,
          direction: signal.direction,
          entry: signal.entry,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          leverage: signal.leverage,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          market: signal.market,
          category: signal.category,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Netzwerkfehler" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setRevalidation(data);
    } catch (err) {
      setRevalError(err instanceof Error ? err.message : "Revalidierung fehlgeschlagen");
    } finally {
      setRevalidating(false);
    }
  }

  // Schritt 2: Trade mit aktualisierten Werten bestätigen
  async function handleConfirmPosition() {
    if (!portfolio || allocatedBudget <= 0 || !revalidation) return;
    try {
      const { addTrade } = await import("@/lib/portfolio-store");
      await addTrade({
        portfolioId: portfolio.id,
        signalId: signal.id,
        asset: signal.asset,
        direction: signal.direction,
        entry: revalidation.entry,
        stopLoss: revalidation.stopLoss,
        takeProfit: revalidation.takeProfit,
        leverage: signal.leverage,
        budget: allocatedBudget,
        status: "open",
      });
      setPositionOpened(true);
      setRevalidation(null);
    } catch (err) {
      console.error("Trade öffnen fehlgeschlagen:", err);
    }
  }

  // Abbrechen
  function handleCancelRevalidation() {
    setRevalidation(null);
    setRevalError(null);
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
        gainBg: "bg-[#2A2A2A]",
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
        gainBg: "bg-white",
      };

  return (
    <div className={`rounded-[12px] ${c.bg} overflow-hidden`}>
      {/* Position aktiv: Countdown-Balken */}
      {positionOpened && marketInfo.closeSeconds !== null && (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-bold ${c.text}`}>Position läuft</span>
            <span className={`text-xs font-medium ${c.timerText}`}>
              schließt in {formatTimer(marketInfo.closeSeconds)}
            </span>
          </div>
          <div className={`w-full h-1.5 rounded-full ${isBold ? "bg-white/10" : "bg-border"}`}>
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                marketInfo.closeSeconds < 3600
                  ? "bg-red-500"
                  : marketInfo.closeSeconds < 7200
                    ? "bg-amber-500"
                    : isBold ? "bg-white" : "bg-text-primary"
              }`}
              style={{
                width: `${Math.max(2, (marketInfo.closeSeconds / marketInfo.totalTradingSeconds) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Collapsed View */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-5 text-left"
      >
        {/* Timer oben rechts – nur wenn keine Position aktiv */}
        {!positionOpened && (
          <div className="flex justify-end mb-3">
            <div className="flex items-center gap-1.5">
              <ClockIcon className={`w-3.5 h-3.5 ${c.timerText}`} />
              <span className={`text-xs font-medium ${c.timerText}`}>
                {marketInfo.timerSeconds !== null
                  ? `${marketInfo.timerLabel} ${formatTimer(marketInfo.timerSeconds)}`
                  : marketInfo.timerLabel}
              </span>
            </div>
          </div>
        )}

        {/* Direction / Category / Leverage – direkt über Asset */}
        <p className={`text-sm font-bold ${c.text} mb-1`}>
          {signal.direction} · {signal.category} · {signal.leverage}
        </p>

        {/* Asset + Confidence */}
        <div className="flex items-end justify-between">
          <h3 className={`text-[32px] leading-tight font-black ${c.text}`}>{signal.asset}</h3>
          <div className="text-right">
            <p className={`text-[32px] leading-tight font-black ${c.text}`}>{signal.confidence}%</p>
            <p className={`text-[11px] ${c.textMut}`}>Konfidenz</p>
          </div>
        </div>

        {/* Expected Gain */}
        <div className="flex items-center justify-between mt-5">
          <div className={`${c.gainBg} rounded-[6px] px-3 py-1.5`}>
            <p className={`text-sm ${c.text}`}>
              <span className="font-bold">+{signal.expectedGainPercent}%</span>
              {" · "}
              {hasPortfolio ? (
                <>
                  +{expectedGainEuro}€ bei {allocatedBudget}€
                </>
              ) : (
                <>
                  +{exampleGain}€ bei {exampleBudget}€
                </>
              )}
            </p>
          </div>
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

          {/* Risk + Budget Info – nur mit Portfolio */}
          {hasPortfolio && (
            <div className={`pt-4 border-t ${c.border} space-y-1`}>
              <div className="flex justify-between text-sm">
                <span className={c.textSec}>Einsatz (Kelly)</span>
                <span className={`font-bold ${c.text}`}>{allocatedBudget}€</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={c.textSec}>Max. Verlust</span>
                <span className={`font-bold ${c.text}`}>-{maxLossEuro}€</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={c.textSec}>Erwarteter Gewinn</span>
                <span className={`font-bold ${c.text}`}>+{expectedGainEuro}€</span>
              </div>
            </div>
          )}

          {/* Position eröffnen – nur mit Portfolio */}
          {hasPortfolio && (
            <>
              {positionOpened ? (
                /* ── Position aktiv ── */
                <div className={`pt-4 border-t ${c.border} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${c.text}`}>Position aktiv</span>
                    <span className={`text-sm ${c.textSec}`}>{allocatedBudget}€</span>
                  </div>
                  <button
                    className={`w-full rounded-[6px] py-3.5 text-sm font-bold transition-colors ${c.btnOutline}`}
                  >
                    Position schließen
                  </button>
                </div>
              ) : revalidating ? (
                /* ── Wird geprüft ── */
                <div className={`pt-4 border-t ${c.border}`}>
                  <div className="flex items-center justify-center gap-2 py-3.5">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
                    <span className={`text-sm font-bold ${c.text}`}>Kurs wird geprüft…</span>
                  </div>
                </div>
              ) : revalidation ? (
                /* ── Revalidierungs-Ergebnis ── */
                <div className={`pt-4 border-t ${c.border} space-y-3`}>
                  {revalidation.valid ? (
                    <>
                      {/* Bestätigt */}
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 text-base">✓</span>
                        <span className={`text-sm font-bold ${c.text}`}>Trade bestätigt</span>
                        <span className={`text-xs ${c.textMut} ml-auto`}>
                          Konfidenz: {revalidation.confidence}%
                        </span>
                      </div>
                      <p className={`text-xs ${c.textSec} leading-relaxed`}>{revalidation.reason}</p>

                      {/* Aktualisierte Werte */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className={`text-[11px] ${c.textMut} uppercase`}>Entry</p>
                          <p className={`text-sm font-bold ${c.text} mt-0.5`}>
                            {revalidation.entry.toLocaleString("de-DE")}
                          </p>
                          {revalidation.entry !== signal.entry && (
                            <p className={`text-[10px] ${c.textMut} line-through`}>
                              {signal.entry.toLocaleString("de-DE")}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className={`text-[11px] ${c.textMut} uppercase`}>Stop-Loss</p>
                          <p className={`text-sm font-bold ${c.text} mt-0.5`}>
                            {revalidation.stopLoss.toLocaleString("de-DE")}
                          </p>
                        </div>
                        <div>
                          <p className={`text-[11px] ${c.textMut} uppercase`}>Take-Profit</p>
                          <p className={`text-sm font-bold ${c.text} mt-0.5`}>
                            {revalidation.takeProfit.toLocaleString("de-DE")}
                          </p>
                        </div>
                      </div>

                      {/* Bestätigen / Abbrechen */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmPosition}
                          className={`flex-1 rounded-[6px] ${c.btnBg} py-3 text-sm font-bold ${c.btnText} transition-colors ${c.btnHover}`}
                        >
                          Bestätigen · {allocatedBudget}€
                        </button>
                        <button
                          onClick={handleCancelRevalidation}
                          className={`rounded-[6px] px-4 py-3 text-sm font-bold transition-colors ${c.btnOutline}`}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Trade ungültig */}
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 text-base">✕</span>
                        <span className={`text-sm font-bold ${c.text}`}>Trade nicht mehr empfohlen</span>
                      </div>
                      <p className={`text-xs ${c.textSec} leading-relaxed`}>{revalidation.reason}</p>
                      <button
                        onClick={handleCancelRevalidation}
                        className={`w-full rounded-[6px] py-3 text-sm font-bold transition-colors ${c.btnOutline}`}
                      >
                        Verstanden
                      </button>
                    </>
                  )}
                </div>
              ) : revalError ? (
                /* ── Fehler ── */
                <div className={`pt-4 border-t ${c.border} space-y-2`}>
                  <p className={`text-xs ${c.textSec}`}>{revalError}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRevalidate}
                      className={`flex-1 rounded-[6px] ${c.btnBg} py-3 text-sm font-bold ${c.btnText} transition-colors ${c.btnHover}`}
                    >
                      Erneut prüfen
                    </button>
                    <button
                      onClick={handleCancelRevalidation}
                      className={`rounded-[6px] px-4 py-3 text-sm font-bold transition-colors ${c.btnOutline}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Position eröffnen Button ── */
                <div className={`pt-4 border-t ${c.border}`}>
                  <button
                    onClick={handleRevalidate}
                    className={`w-full rounded-[6px] ${c.btnBg} py-3.5 text-sm font-bold ${c.btnText} transition-colors ${c.btnHover}`}
                  >
                    Position eröffnen · {allocatedBudget}€
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
