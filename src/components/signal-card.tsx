"use client";

import { useState, useEffect } from "react";
import type { Signal } from "@/lib/mock-signals";
import type { Portfolio } from "@/lib/portfolio-store";
import { getOpenTradeForSignal, getTradeForSignal, closeTrade, type Trade } from "@/lib/portfolio-store";
import { getMarketInfo, formatTimer } from "@/lib/market-hours";
import { scheduleCloseNotification, cancelCloseNotification } from "@/lib/notifications";
import { queueCloseReminder, unqueueCloseReminder } from "@/lib/push-queue";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button onClick={handleCopy} className={`inline-flex items-center shrink-0 ${className || ""}`}>
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-white hover:text-white/80 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );
}

function CopyableValue({ label, value, displayValue }: { label: string; value: string; displayValue?: string }) {
  return (
    <div>
      <p className="text-[13px] text-white/55 uppercase">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <p className="text-base font-bold text-white">{displayValue || value}</p>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

// Typische XTB-Spreads als % vom Kurs (konservative Schätzung, Round-Trip)
const SPREAD_PERCENT: Record<string, number> = {
  Index: 0.03,
  Aktie: 0.06,
  Forex: 0.015,
  Rohstoff: 0.04,
  Krypto: 0.20,
};

// XTB Volumen berechnen: Budget × Leverage / Kurs
// Bei Aktien: Lots = Anzahl Aktien. Bei Indizes/Forex/Krypto: Lots.
function calculateVolume(budget: number, leverage: number, entry: number, category: string): string {
  const positionSize = budget * leverage;
  const lots = positionSize / entry;

  if (category === "Forex") {
    // Forex: 1 Lot = 100.000 Einheiten, XTB erlaubt Micro-Lots (0.01)
    const forexLots = lots / 100000;
    return forexLots < 0.01 ? "0.01" : forexLots.toFixed(2);
  }

  // Aktien, Indizes, Krypto, Rohstoffe: direkte Lot-Angabe
  if (lots < 0.01) return "0.01";
  if (lots >= 1) return lots.toFixed(2);
  return lots.toFixed(3);
}

export default function SignalCard({
  signal,
  portfolio,
  allocatedBudget,
  onPortfolioUpdate,
}: {
  signal: Signal;
  portfolio: Portfolio | null;
  allocatedBudget: number;
  onPortfolioUpdate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
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

  // Close-Position State
  const [openTrade, setOpenTrade] = useState<Trade | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<{
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
  } | null>(null);
  const [positionClosed, setPositionClosed] = useState(false);
  const [signalInvalid, setSignalInvalid] = useState(false);

  // Live P&L für offene Positionen
  const [livePnl, setLivePnl] = useState<{
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  } | null>(null);

  // Prüfen ob schon ein Trade für dieses Signal existiert (offen oder geschlossen)
  useEffect(() => {
    // State resetten wenn Portfolio wechselt oder weg ist
    setPositionOpened(false);
    setPositionClosed(false);
    setOpenTrade(null);
    setCloseResult(null);

    if (!portfolio) return;
    getTradeForSignal(portfolio.id, signal.id)
      .then((trade) => {
        if (trade) {
          if (trade.status === "open") {
            setPositionOpened(true);
            setOpenTrade(trade);
            // Close-Reminder: lokal + Server-Push
            scheduleCloseNotification(signal.id, signal.asset, signal.marketCloseTime);
            queueCloseReminder(signal.id, signal.asset, signal.marketCloseTime);
          } else {
            setPositionClosed(true);
            setOpenTrade(trade);
            if (trade.result != null) {
              setCloseResult({
                exitPrice: trade.exitPrice || 0,
                pnl: trade.result,
                pnlPercent: trade.budget > 0 ? Math.round((trade.result / trade.budget) * 100 * 100) / 100 : 0,
              });
            }
          }
        }
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

  // Auto-Close: alle 60 Sekunden prüfen ob SL/TP erreicht wurde
  useEffect(() => {
    if (!positionOpened || !openTrade || positionClosed) return;

    async function checkAutoClose() {
      try {
        const res = await fetch(`/api/price?ticker=${encodeURIComponent(signal.ticker)}`);
        if (!res.ok) return;
        const { price } = await res.json();
        if (!price) return;

        const trade = openTrade!;
        const lev = parseFloat(signal.leverage);

        // Live P&L berechnen (bei jedem Price-Check, mit Spread)
        const liveSpreadCost = (SPREAD_PERCENT[signal.category] || 0.05) * lev;
        const liveDiff = trade.direction === "LONG"
          ? price - trade.entry
          : trade.entry - price;
        const livePnlPct = (liveDiff / trade.entry) * 100 * lev - liveSpreadCost;
        const livePnlEur = Math.round(trade.budget * (livePnlPct / 100) * 100) / 100;
        setLivePnl({
          currentPrice: price,
          pnl: livePnlEur,
          pnlPercent: Math.round(livePnlPct * 100) / 100,
        });

        let shouldClose = false;
        let exitPrice = price;
        let reason = "";

        if (trade.direction === "LONG") {
          if (price <= trade.stopLoss) {
            shouldClose = true;
            exitPrice = trade.stopLoss;
            reason = "Stop-Loss erreicht";
          } else if (price >= trade.takeProfit) {
            shouldClose = true;
            exitPrice = trade.takeProfit;
            reason = "Take-Profit erreicht";
          }
        } else {
          if (price >= trade.stopLoss) {
            shouldClose = true;
            exitPrice = trade.stopLoss;
            reason = "Stop-Loss erreicht";
          } else if (price <= trade.takeProfit) {
            shouldClose = true;
            exitPrice = trade.takeProfit;
            reason = "Take-Profit erreicht";
          }
        }

        if (shouldClose) {
          const closeSpreadCost = (SPREAD_PERCENT[signal.category] || 0.05) * lev;
          const priceDiff = trade.direction === "LONG"
            ? exitPrice - trade.entry
            : trade.entry - exitPrice;
          const pnlPct = (priceDiff / trade.entry) * 100 * lev - closeSpreadCost;
          const pnl = Math.round(trade.budget * (pnlPct / 100) * 100) / 100;

          await closeTrade(trade.id, exitPrice, pnl);
          setPositionClosed(true);
          setPositionOpened(false);
          setCloseResult({ exitPrice, pnl, pnlPercent: Math.round(pnlPct * 100) / 100 });
          cancelCloseNotification(signal.id);
          unqueueCloseReminder(signal.id);
          onPortfolioUpdate?.();
          console.log(`Auto-Close: ${signal.asset} – ${reason} (${pnl >= 0 ? "+" : ""}${pnl}€)`);
        }
      } catch {
        // Stille Fehlerbehandlung – nächster Check in 60s
      }
    }

    // Sofort prüfen + dann alle 60 Sekunden
    checkAutoClose();
    const interval = setInterval(checkAutoClose, 60000);
    return () => clearInterval(interval);
  }, [positionOpened, openTrade, positionClosed, signal.ticker]);

  const isBold = signal.riskClass === "bold";
  // Bei offener Position: echtes Trade-Budget verwenden, nicht Kelly-Allokation
  const effectiveBudget = positionOpened && openTrade ? openTrade.budget : allocatedBudget;
  const hasPortfolio = portfolio !== null && effectiveBudget > 0;

  // Berechnungen basierend auf Kelly-Allokation vom Dashboard
  const leverage = parseFloat(signal.leverage);
  const spreadPct = SPREAD_PERCENT[signal.category] || 0.05;
  const spreadCostPct = spreadPct * leverage; // Spread × Hebel = effektive Kosten in %

  const tpPctRaw =
    signal.direction === "LONG"
      ? ((signal.takeProfit - signal.entry) / signal.entry) * 100
      : ((signal.entry - signal.takeProfit) / signal.entry) * 100;
  const slPctRaw =
    signal.direction === "LONG"
      ? ((signal.entry - signal.stopLoss) / signal.entry) * 100
      : ((signal.stopLoss - signal.entry) / signal.entry) * 100;

  // Spread-bereinigt: Gewinn wird kleiner, Verlust wird größer
  const tpPercent = tpPctRaw * leverage - spreadCostPct;
  const slPercent = slPctRaw * leverage + spreadCostPct;

  const expectedGainEuro = hasPortfolio
    ? (effectiveBudget * tpPercent / 100).toFixed(2)
    : "0";
  const maxLossEuro = hasPortfolio
    ? (effectiveBudget * slPercent / 100).toFixed(2)
    : "0";

  // Beispielrechnung ohne Portfolio (200€ Beispiel)
  const exampleBudget = 200;
  const exampleGain = (exampleBudget * tpPercent / 100).toFixed(0);

  // Schritt 1: Revalidierung starten
  async function handleRevalidate() {
    if (!portfolio || effectiveBudget <= 0) return;
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
    if (!portfolio || effectiveBudget <= 0 || !revalidation) return;
    try {
      const { addTrade } = await import("@/lib/portfolio-store");
      const trade = await addTrade({
        portfolioId: portfolio.id,
        signalId: signal.id,
        asset: signal.asset,
        direction: signal.direction,
        entry: revalidation.entry,
        stopLoss: revalidation.stopLoss,
        takeProfit: revalidation.takeProfit,
        leverage: signal.leverage,
        budget: effectiveBudget,
        status: "open",
      });
      setOpenTrade(trade);
      setPositionOpened(true);
      setRevalidation(null);
      // Close-Reminder: lokal (wenn App offen) + Server-Push (wenn App zu)
      scheduleCloseNotification(signal.id, signal.asset, signal.marketCloseTime);
      queueCloseReminder(signal.id, signal.asset, signal.marketCloseTime);
      onPortfolioUpdate?.();
    } catch (err) {
      console.error("Trade öffnen fehlgeschlagen:", err);
    }
  }

  // Abbrechen
  function handleCancelRevalidation() {
    setRevalidation(null);
    setRevalError(null);
  }

  // Position schließen: aktuellen Kurs holen + P&L berechnen
  async function handleClosePosition() {
    if (!openTrade) return;
    try {
      setClosing(true);
      const res = await fetch(`/api/price?ticker=${encodeURIComponent(signal.ticker)}`);
      if (!res.ok) throw new Error("Kurs nicht verfügbar");

      const { price } = await res.json();
      const leverage = parseFloat(signal.leverage);

      // P&L berechnen (mit Spread)
      const manualSpreadCost = (SPREAD_PERCENT[signal.category] || 0.05) * leverage;
      const priceDiff = openTrade.direction === "LONG"
        ? price - openTrade.entry
        : openTrade.entry - price;
      const pnlPercent = (priceDiff / openTrade.entry) * 100 * leverage - manualSpreadCost;
      const pnl = openTrade.budget * (pnlPercent / 100);

      setCloseResult({
        exitPrice: price,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
      });
    } catch (err) {
      console.error("Kurs laden fehlgeschlagen:", err);
    } finally {
      setClosing(false);
    }
  }

  // Position endgültig schließen + Portfolio updaten
  async function handleConfirmClose() {
    if (!openTrade || !closeResult) return;
    try {
      await closeTrade(openTrade.id, closeResult.exitPrice, closeResult.pnl);
      setPositionClosed(true);
      setPositionOpened(false);
      setCloseResult(null);
      cancelCloseNotification(signal.id);
      unqueueCloseReminder(signal.id);
      onPortfolioUpdate?.();
    } catch (err) {
      console.error("Position schließen fehlgeschlagen:", err);
    }
  }

  // Einheitliches dunkles Farb-Schema für beide Karten
  const c = {
    bg: "bg-[#1A1A1A]",
    text: "text-white",
    textSec: "text-white",
    textMut: "text-white/55",
    border: "border-white/10",
    btnBg: "bg-white",
    btnText: "text-[#1A1A1A]",
    btnHover: "hover:bg-white/90",
    btnOutline: "border border-white/20 text-white hover:border-white/40",
    timerText: "text-white/55",
    gainBg: "bg-[#2A2A2A]",
  };

  return (
    <div className={`rounded-[12px] ${c.bg} overflow-hidden`}>
      {/* Position aktiv: Countdown-Balken */}
      {positionOpened && marketInfo.closeSeconds !== null && (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[13px] font-bold ${c.text}`}>Position läuft</span>
            <span className={`text-[13px] font-medium ${c.timerText}`}>
              schließt in {formatTimer(marketInfo.closeSeconds)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                marketInfo.closeSeconds < 3600
                  ? "bg-red-500"
                  : marketInfo.closeSeconds < 7200
                    ? "bg-amber-500"
                    : "bg-white"
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
        className="w-full px-5 py-4 text-left"
      >
        {/* Zeile 1: Direction/Category/Leverage + Status */}
        <div className="flex items-center justify-between mb-1">
          <p className={`text-sm font-bold ${c.text}`}>
            {signal.direction} · {signal.category} · {signal.leverage}
          </p>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              positionClosed
                ? (closeResult && closeResult.pnl >= 0 ? "bg-green-400" : "bg-red-400")
                : positionOpened
                  ? "bg-amber-400"
                  : signalInvalid
                    ? "bg-red-400"
                    : marketInfo.marketPhase === "post_close"
                      ? "bg-white/30"
                      : marketInfo.marketPhase === "open"
                        ? "bg-green-400"
                        : marketInfo.marketPhase === "closing_soon"
                          ? "bg-amber-400"
                          : "bg-blue-400"
            }`} />
            <span className={`text-[13px] font-medium ${
              positionClosed
                ? (closeResult && closeResult.pnl >= 0 ? "text-green-400" : "text-red-400")
                : positionOpened
                  ? "text-amber-400"
                  : signalInvalid
                    ? "text-red-400"
                    : c.timerText
            }`}>
              {positionClosed
                ? (closeResult ? `${closeResult.pnl >= 0 ? "+" : ""}${closeResult.pnl}€` : "Abgeschlossen")
                : positionOpened
                  ? "Position läuft"
                  : signalInvalid
                    ? "Signal ungültig"
                    : marketInfo.marketPhase === "post_close"
                      ? "Abgelaufen"
                      : marketInfo.timerSeconds !== null
                        ? `${marketInfo.timerLabel} ${formatTimer(marketInfo.timerSeconds)}`
                        : marketInfo.timerLabel}
            </span>
          </div>
        </div>

        {/* Zeile 2+3: Asset + Confidence */}
        <div className="flex items-baseline justify-between mt-[10px]">
          <h3 className={`text-[28px] leading-none font-black ${c.text}`}>{signal.asset}</h3>
          <p className={`text-[28px] leading-none font-black ${c.text}`}>{signal.confidence}%</p>
        </div>
        <div className="flex items-center justify-between mt-[2px]">
          <div className="flex items-center gap-1.5">
            <span className={`text-[13px] font-medium ${c.textMut}`}>{signal.ticker}</span>
            <CopyButton value={signal.ticker} />
          </div>
          <p className={`text-[13px] font-medium ${c.text}`}>Konfidenz</p>
        </div>

        {/* Zeile 3: Live P&L / Ergebnis / Expected Gain + Chevron */}
        <div className="flex items-center justify-between mt-3">
          {positionOpened && livePnl ? (
            /* Live P&L bei offener Position */
            <div className={`${livePnl.pnl >= 0 ? "bg-green-500/15" : "bg-red-500/15"} rounded-[6px] px-3 py-1.5`}>
              <p className={`text-sm ${livePnl.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                <span className="text-white">{effectiveBudget}€</span>
                {" · "}
                <span className="font-bold">{livePnl.pnlPercent >= 0 ? "+" : ""}{livePnl.pnlPercent.toFixed(1)}%</span>
                {" · "}
                <span className="font-bold">{livePnl.pnl >= 0 ? "+" : ""}{livePnl.pnl.toFixed(2)}€</span>
              </p>
            </div>
          ) : positionClosed && closeResult ? (
            /* Ergebnis bei geschlossener Position */
            <div className={`${closeResult.pnl >= 0 ? "bg-green-500/15" : "bg-red-500/15"} rounded-[6px] px-3 py-1.5`}>
              <p className={`text-sm ${closeResult.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                <span className="text-white">{effectiveBudget}€</span>
                {" · "}
                <span className="font-bold">{closeResult.pnlPercent >= 0 ? "+" : ""}{closeResult.pnlPercent.toFixed(1)}%</span>
                {" · "}
                <span className="font-bold">{closeResult.pnl >= 0 ? "+" : ""}{closeResult.pnl.toFixed(2)}€</span>
              </p>
            </div>
          ) : (
            /* Erwarteter Gewinn (Standard) */
            <div className={`${c.gainBg} rounded-[6px] px-3 py-1.5`}>
              <p className={`text-sm ${c.text}`}>
                <span className="font-bold">+{tpPercent.toFixed(1)}%</span>
                {" · "}
                {hasPortfolio ? (
                  <>
                    +{expectedGainEuro}€ bei {effectiveBudget}€
                  </>
                ) : (
                  <>
                    +{exampleGain}€ bei {exampleBudget}€
                  </>
                )}
              </p>
            </div>
          )}
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
          {positionClosed ? (
            /* ── Geschlossene Position: kompakte Übersicht ── */
            <>
              {/* Entry → Exit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={`text-[13px] ${c.textMut} uppercase`}>Einstieg</p>
                  <p className={`text-base font-bold ${c.text} mt-0.5`}>{(openTrade?.entry || signal.entry).toLocaleString("de-DE")}</p>
                </div>
                <div>
                  <p className={`text-[13px] ${c.textMut} uppercase`}>Ausstieg</p>
                  <p className={`text-base font-bold ${c.text} mt-0.5`}>{closeResult?.exitPrice ? closeResult.exitPrice.toLocaleString("de-DE") : "–"}</p>
                </div>
              </div>

              {/* Einsatz → Endwert */}
              <div className={`grid grid-cols-2 gap-3 py-3 border-t ${c.border}`}>
                <div>
                  <p className={`text-[13px] ${c.textMut} uppercase`}>Einsatz</p>
                  <p className={`text-base font-bold ${c.text} mt-0.5`}>{effectiveBudget}€</p>
                </div>
                <div>
                  <p className={`text-[13px] ${c.textMut} uppercase`}>Endwert</p>
                  <p className={`text-base font-bold ${closeResult && closeResult.pnl >= 0 ? "text-green-400" : "text-red-400"} mt-0.5`}>
                    {closeResult ? (effectiveBudget + closeResult.pnl).toFixed(2) : effectiveBudget}€
                  </p>
                </div>
              </div>

              {/* Zeitstempel */}
              <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${c.border}`}>
                <div>
                  <p className={`text-[13px] ${c.textMut} uppercase`}>Eröffnet</p>
                  <p className={`text-sm font-semibold ${c.text} mt-0.5`}>
                    {openTrade ? new Date(openTrade.openedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–"}
                  </p>
                </div>
                <div>
                  <p className={`text-[13px] ${c.textMut} uppercase`}>Geschlossen</p>
                  <p className={`text-sm font-semibold ${c.text} mt-0.5`}>
                    {openTrade?.closedAt ? new Date(openTrade.closedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–"}
                  </p>
                </div>
              </div>

              {/* Begründung Toggle */}
              <div className={`pt-4 border-t ${c.border}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReasoning(!showReasoning); }}
                  className={`text-[13px] font-medium ${c.textMut} transition-colors hover:text-white/80`}
                >
                  {showReasoning ? "Begründung ausblenden" : "Begründung anzeigen"}
                </button>
                {showReasoning && (
                  <p className={`text-sm ${c.textSec} leading-relaxed mt-2`}>{signal.reasoning}</p>
                )}
              </div>
            </>
          ) : (
            /* ── Offene / Neue Position: volle Details ── */
            <>
              {/* Entry / SL / TP + Volumen */}
              <div className="grid grid-cols-3 gap-3">
                <CopyableValue label="Einstieg" value={String(signal.entry)} displayValue={signal.entry.toLocaleString("de-DE")} />
                <CopyableValue label="Stop-Loss" value={String(signal.stopLoss)} displayValue={signal.stopLoss.toLocaleString("de-DE")} />
                <CopyableValue label="Take-Profit" value={String(signal.takeProfit)} displayValue={signal.takeProfit.toLocaleString("de-DE")} />
              </div>
              {hasPortfolio && (
                <div className="grid grid-cols-3 gap-3">
                  <CopyableValue
                    label="Volumen (Lots)"
                    value={calculateVolume(effectiveBudget, leverage, signal.entry, signal.category)}
                    displayValue={calculateVolume(effectiveBudget, leverage, signal.entry, signal.category)}
                  />
                </div>
              )}

              {/* Timing */}
              {(() => {
                const showEntry = !positionOpened;
                const showClose = signal.market !== "Krypto";
                if (!showEntry && !showClose) return null;
                return (
                  <div className={`grid ${showEntry && showClose ? "grid-cols-2" : "grid-cols-1"} gap-3 pt-4 border-t ${c.border}`}>
                    {showEntry && (
                      <div>
                        <p className={`text-[13px] ${c.textMut} uppercase`}>Bester Einstieg</p>
                        <p className={`text-sm font-semibold ${c.text} mt-1`}>{signal.optimalEntry}</p>
                      </div>
                    )}
                    {showClose && (
                      <div>
                        <p className={`text-[13px] ${c.textMut} uppercase`}>Markt schließt</p>
                        <p className={`text-sm font-semibold ${c.text} mt-1`}>{signal.marketCloseTime}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Reasoning Toggle */}
              <div className={`pt-4 border-t ${c.border}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReasoning(!showReasoning); }}
                  className={`text-[13px] font-medium ${c.textMut} transition-colors hover:text-white/80`}
                >
                  {showReasoning ? "Begründung ausblenden" : "Begründung anzeigen"}
                </button>
                {showReasoning && (
                  <p className={`text-sm ${c.textSec} leading-relaxed mt-2`}>{signal.reasoning}</p>
                )}
              </div>

              {/* Risk + Budget Info */}
              {(hasPortfolio || positionOpened) && (
                <div className={`pt-4 border-t ${c.border} space-y-1`}>
                  <div className="flex justify-between text-sm">
                    <span className={c.textSec}>Einsatz</span>
                    <span className={`font-bold ${c.text}`}>{effectiveBudget}€</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={c.textSec}>Max. Verlust</span>
                    <span className={`font-bold ${c.text}`}>-{maxLossEuro}€</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={c.textSec}>Max. Gewinn</span>
                    <span className={`font-bold ${c.text}`}>+{expectedGainEuro}€</span>
                  </div>
                </div>
              )}

              {/* Position eröffnen / schließen */}
              {(hasPortfolio || positionOpened) && (
                <>
                  {positionOpened ? (
                /* ── Position aktiv ── */
                <div className={`pt-4 border-t ${c.border} space-y-3`}>
                  {closing ? (
                    <div className="flex items-center justify-center gap-2 py-3.5">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
                      <span className={`text-sm font-bold ${c.text}`}>Aktueller Kurs wird geladen…</span>
                    </div>
                  ) : closeResult ? (
                    <>
                      {/* P&L Vorschau */}
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${c.text}`}>Ergebnis</span>
                        <span className={`text-sm font-bold ${closeResult.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {closeResult.pnl >= 0 ? "+" : ""}{closeResult.pnl}€ ({closeResult.pnl >= 0 ? "+" : ""}{closeResult.pnlPercent}%)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <CopyableValue label="Entry" value={String(openTrade?.entry || "")} displayValue={openTrade?.entry.toLocaleString("de-DE")} />
                        <CopyableValue label="Exit (aktuell)" value={String(closeResult.exitPrice)} displayValue={closeResult.exitPrice.toLocaleString("de-DE")} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmClose}
                          className={`flex-1 rounded-[6px] ${closeResult.pnl >= 0 ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"} py-3 text-sm font-bold text-white transition-colors`}
                        >
                          Schließen · {closeResult.pnl >= 0 ? "+" : ""}{closeResult.pnl}€
                        </button>
                        <button
                          onClick={() => setCloseResult(null)}
                          className={`rounded-[6px] px-4 py-3 text-sm font-bold transition-colors ${c.btnOutline}`}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${c.text}`}>Position aktiv</span>
                        <span className={`text-sm ${c.textSec}`}>{effectiveBudget}€</span>
                      </div>
                      <button
                        onClick={handleClosePosition}
                        className={`w-full rounded-[6px] py-3.5 text-sm font-bold transition-colors ${c.btnOutline}`}
                      >
                        Position schließen
                      </button>
                    </>
                  )}
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
                        <span className={`text-sm font-bold ${c.text}`}>Trade geprüft</span>
                        <span className={`text-[13px] ${c.textMut} ml-auto`}>
                          Konfidenz: {revalidation.confidence}%
                        </span>
                      </div>
                      <p className={`text-[13px] ${c.textSec} leading-relaxed`}>{revalidation.reason}</p>

                      {/* Aktualisierte Werte */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <CopyableValue label="Entry" value={String(revalidation.entry)} displayValue={revalidation.entry.toLocaleString("de-DE")} />
                          {revalidation.entry !== signal.entry && (
                            <p className="text-[13px] text-white/55 line-through">
                              {signal.entry.toLocaleString("de-DE")}
                            </p>
                          )}
                        </div>
                        <CopyableValue label="Stop-Loss" value={String(revalidation.stopLoss)} displayValue={revalidation.stopLoss.toLocaleString("de-DE")} />
                        <CopyableValue label="Take-Profit" value={String(revalidation.takeProfit)} displayValue={revalidation.takeProfit.toLocaleString("de-DE")} />
                      </div>

                      {/* Bestätigen / Abbrechen */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmPosition}
                          className={`flex-1 rounded-[6px] ${c.btnBg} py-3 text-sm font-bold ${c.btnText} transition-colors ${c.btnHover}`}
                        >
                          Bestätigen · {effectiveBudget}€
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
                      <p className={`text-[13px] ${c.textSec} leading-relaxed`}>{revalidation.reason}</p>
                      <button
                        onClick={() => {
                          handleCancelRevalidation();
                          setSignalInvalid(true);
                        }}
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
                  <p className={`text-[13px] ${c.textSec}`}>{revalError}</p>
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
                    disabled={!marketInfo.isOpen || signalInvalid || effectiveBudget <= 0}
                    className={`w-full rounded-[6px] py-3.5 text-sm font-bold transition-colors ${
                      signalInvalid || effectiveBudget <= 0
                        ? "bg-white/10 text-white/30 cursor-not-allowed"
                        : marketInfo.isOpen
                          ? `${c.btnBg} ${c.btnText} ${c.btnHover}`
                          : "bg-white/10 text-white/30 cursor-not-allowed"
                    }`}
                  >
                    {signalInvalid
                      ? "Signal ungültig"
                      : effectiveBudget <= 0
                        ? "Nicht genug Budget"
                        : marketInfo.isOpen
                          ? `Position eröffnen · ${effectiveBudget}€`
                          : "Markt geschlossen"}
                  </button>
                </div>
              )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
