"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Signal } from "@/lib/mock-signals";
import { getActivePortfolio, allocateCapital, getOpenTradeForSignal, getOpenTrades, getRiskMultiplier, type Portfolio } from "@/lib/portfolio-store";
import SignalCard from "./signal-card";
import TradeHistory from "./trade-history";
import CreatePortfolio from "./create-portfolio";
import EditPortfolio from "./edit-portfolio";
import PortfolioHeader from "./portfolio-header";
import MobileMenu from "./mobile-menu";
import SignOutButton from "@/app/sign-out-button";
import { isWeekend, isXetraHoliday, isNYSEHoliday } from "@/lib/market-hours";
import {
  initNotifications,
  requestPermission,
  hasPermission,
  permissionState,
  scheduleEntryNotification,
  subscribeToPush,
} from "@/lib/notifications";
import { queueEntryReminder } from "@/lib/push-queue";

interface ScanCandidate {
  asset: string;
  ticker: string;
  category: string;
  market: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  note: string;
}

type Tab = "signals" | "trades";

function parseSignalInputs(signals: { steady: Signal; bold: Signal }) {
  return [signals.steady, signals.bold].map((s) => {
    const slPercent =
      s.direction === "LONG"
        ? ((s.entry - s.stopLoss) / s.entry) * 100
        : ((s.stopLoss - s.entry) / s.entry) * 100;
    const rr = parseFloat(s.riskRewardRatio.split(":")[1]);
    return {
      confidence: s.confidence,
      riskRewardRatio: rr,
      stopLossPercent: slPercent,
      leverage: parseFloat(s.leverage),
    };
  });
}

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showEditPortfolio, setShowEditPortfolio] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("signals");
  const [loaded, setLoaded] = useState(false);
  const [signals, setSignals] = useState<{ steady: Signal; bold: Signal } | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [signalsWaitUntil, setSignalsWaitUntil] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<"unknown" | "granted" | "denied" | "prompt" | "unsupported">("unknown");
  const [openTradeSignals, setOpenTradeSignals] = useState<Set<string>>(new Set());
  const [openTradeCount, setOpenTradeCount] = useState(0);
  const [investedAmount, setInvestedAmount] = useState(0);
  const [scanCandidates, setScanCandidates] = useState<ScanCandidate[] | null>(null);
  const [riskMultiplier, setRiskMultiplier] = useState(1.0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  async function loadPortfolio() {
    try {
      const p = await getActivePortfolio();
      setPortfolio(p);
    } catch (err) {
      console.error("Portfolio laden fehlgeschlagen:", err);
    }
  }

  async function loadSignals() {
    try {
      setSignalsLoading(true);
      setSignalsError(null);
      const res = await fetch("/api/signals");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Netzwerkfehler" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.waitUntil) {
        setSignalsWaitUntil(data.waitUntil);
        // Wenn Signale warten (Wochentag vor 13:30): Scan-Kandidaten laden
        if (data.waitUntil === "13:30") {
          try {
            const scanRes = await fetch("/api/signals/scan");
            if (scanRes.ok) {
              const scanData = await scanRes.json();
              if (scanData.candidates) {
                setScanCandidates(scanData.candidates);
              }
            }
          } catch {
            // Scan-Fehler ist nicht kritisch
          }
        }
        return;
      }
      if (data.signals?.steady && data.signals?.bold) {
        setSignals(data.signals);
        setSignalsWaitUntil(null);
        setScanCandidates(null);
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Signale laden fehlgeschlagen:", err);
      setSignalsError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSignalsLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadPortfolio(), loadSignals()]).then(() => setLoaded(true));
    // Service Worker + Notifications initialisieren
    initNotifications().then(() => {
      const state = permissionState();
      if (state === "unsupported") setNotifState("unsupported");
      else if (state === "granted") {
        setNotifState("granted");
        // Push-Subscription erneuern (falls Browser/Gerät gewechselt)
        subscribeToPush();
      }
      else if (state === "denied") setNotifState("denied");
      else setNotifState("prompt"); // "default" → show prompt
    });
  }, []);

  // Risiko-Bremse prüfen
  useEffect(() => {
    if (!portfolio) return;
    getRiskMultiplier(portfolio.id).then(setRiskMultiplier);
  }, [portfolio]);

  // Offene Trades prüfen (damit Karten trotz niedriger Konfidenz sichtbar bleiben)
  useEffect(() => {
    if (!signals || !portfolio) return;
    async function checkOpenTrades() {
      const openIds = new Set<string>();
      let todayInvested = 0;
      for (const s of [signals!.steady, signals!.bold]) {
        const trade = await getOpenTradeForSignal(portfolio!.id, s.id);
        if (trade) {
          openIds.add(s.id);
          todayInvested += trade.budget || 0;
        }
      }
      setOpenTradeSignals(openIds);

      // Überfällige offene Trades + heutige zusammenzählen
      try {
        const allOpen = await getOpenTrades(portfolio!.id);
        setOpenTradeCount(allOpen.length);
        const overdueInvested = allOpen.reduce((sum, t) => sum + (t.budget || 0), 0);
        setInvestedAmount(overdueInvested + todayInvested);
      } catch {
        setInvestedAmount(todayInvested);
      }
    }
    checkOpenTrades();
  }, [signals, portfolio]);

  // Auto-Refresh wenn App in den Vordergrund kommt (PWA)
  const refreshAll = useCallback(() => {
    loadPortfolio();
    loadSignals();
  }, []);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        refreshAll();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshAll]);

  // Pull-to-Refresh (Touch-Geste)
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        pullStartY.current = e.touches[0].clientY;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (pullStartY.current === null) return;
      const dy = e.touches[0].clientY - pullStartY.current;
      if (dy > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(dy * 0.4, 80));
        if (dy > 60) e.preventDefault();
      }
    }
    function onTouchEnd() {
      if (pullDistance > 50) {
        setPullRefreshing(true);
        refreshAll();
        setTimeout(() => setPullRefreshing(false), 1000);
      }
      pullStartY.current = null;
      setPullDistance(0);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, refreshAll]);

  // Entry-Notifications schedulen sobald Signale geladen sind
  useEffect(() => {
    if (!signals || !portfolio) return;
    async function scheduleEntries() {
      for (const s of [signals!.steady, signals!.bold]) {
        // Nicht queuen wenn schon ein Trade für dieses Signal existiert
        const trade = await getOpenTradeForSignal(portfolio!.id, s.id);
        if (trade) continue;
        // Server-Push (funktioniert auch wenn App geschlossen)
        queueEntryReminder(s.id, s.asset, s.direction, s.leverage, s.entry, s.optimalEntry);
        // Lokaler Timer als Fallback (wenn App offen)
        if (hasPermission()) {
          scheduleEntryNotification(s.id, s.asset, s.direction, s.leverage, s.entry, s.optimalEntry);
        }
      }
    }
    scheduleEntries();
  }, [signals, portfolio]);

  // Allokation basiert auf Original-Budget (nicht currentBalance),
  // damit die Aufteilung fix bleibt wenn Position 1 schon offen ist
  const rawAllocations = portfolio && signals
    ? allocateCapital(portfolio.budget, parseSignalInputs(signals))
    : [0, 0];
  const allocations = rawAllocations.map(a => Math.floor(a * riskMultiplier));

  const totalPnl = portfolio ? (portfolio.currentBalance + investedAmount - portfolio.budget) : 0;

  interface StatusBlock { label: string; time?: string }
  function getStatusBar(): { now: StatusBlock; next: StatusBlock } | null {
    if (!loaded || !portfolio) return null;
    if (activeTab !== "signals") return null;

    const now = new Date();
    const cet = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
    const h = cet.getHours();
    const m = cet.getMinutes();
    const mins = h * 60 + m;
    const isWE = isWeekend();
    const day = cet.getDay();
    const tomorrowLabel = isWE || day === 5 || day === 6 ? "Montag" : "Morgen";

    if (openTradeCount > 0) {
      if (mins >= 22 * 60) {
        return {
          now: { label: "Trade offen" },
          next: { label: "Position schließen", time: "Jetzt" },
        };
      }
      const nextCheck30 = Math.ceil((mins + 1) / 30) * 30;
      const nextH = Math.floor(nextCheck30 / 60);
      const nextM = nextCheck30 % 60;
      const nextTime = `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
      if (mins >= 21 * 60 + 30) {
        return {
          now: { label: "Trade aktiv" },
          next: { label: "Position schließen", time: "22:00" },
        };
      }
      return {
        now: { label: "Trade aktiv" },
        next: { label: "Nächste Prüfung", time: nextTime },
      };
    }

    if (signals && !signalsWaitUntil) {
      const hasVisibleSignal =
        (signals.steady.confidence >= 70 || openTradeSignals.has(signals.steady.id)) ||
        (signals.bold.confidence >= 50 || openTradeSignals.has(signals.bold.id));
      if (hasVisibleSignal) {
        return {
          now: { label: "Empfehlungen bereit" },
          next: { label: "Trade eröffnen" },
        };
      }
      return {
        now: { label: "Keine Empfehlung heute" },
        next: { label: "Neue Analyse", time: tomorrowLabel },
      };
    }

    if (signalsLoading) {
      return {
        now: { label: "Analyse läuft…" },
        next: { label: "Trade eröffnen" },
      };
    }

    if (signalsWaitUntil) {
      if (scanCandidates && scanCandidates.length > 0) {
        return {
          now: { label: "Markt-Check fertig" },
          next: { label: "Finale Analyse", time: signalsWaitUntil },
        };
      }
      if (mins >= 9 * 60 + 15) {
        return {
          now: { label: "Märkte laufen an" },
          next: { label: "Finale Analyse", time: signalsWaitUntil },
        };
      }
      return {
        now: { label: "Börse geschlossen" },
        next: { label: "Markt-Check", time: "09:15" },
      };
    }

    if (mins >= 22 * 60) {
      return {
        now: { label: "Fertig für heute" },
        next: { label: "Neue Analyse", time: tomorrowLabel },
      };
    }

    return null;
  }

  const statusBar = getStatusBar();

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-primary">
        <img src="/logo.svg" alt="Tradent" className="h-4 shrink-0" />

        {/* Desktop (≥768px) */}
        <div className="hidden md:flex items-center gap-3">
          {portfolio ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-primary">{portfolio.currentBalance.toFixed(0)}€</span>
                {investedAmount > 0 && (
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                    <span className="text-sm font-bold text-amber-500">{investedAmount.toFixed(0)}€</span>
                  </div>
                )}
                {totalPnl !== 0 && (
                  <span className={`text-sm font-bold ${totalPnl > 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {totalPnl > 0 ? "+" : ""}{totalPnl.toFixed(0)}€
                  </span>
                )}
              </div>
              <PortfolioHeader
                portfolio={portfolio}
                onUpdate={loadPortfolio}
                onCreateNew={() => setShowCreatePortfolio(true)}
                onDeleted={async () => {
                  const p = await getActivePortfolio();
                  setPortfolio(p);
                }}
                onEdit={() => setShowEditPortfolio(true)}
              />
            </>
          ) : (
            <button
              onClick={() => setShowCreatePortfolio(true)}
              className="rounded-[6px] bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              Portfolio eröffnen
            </button>
          )}
          <SignOutButton />
        </div>

        {/* Mobile (<768px) */}
        <div className="flex md:hidden items-center gap-3">
          {portfolio && (
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold text-text-primary">{portfolio.currentBalance.toFixed(0)}€</span>
              {investedAmount > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  <span className="text-lg font-bold text-amber-500">{investedAmount.toFixed(0)}€</span>
                </div>
              )}
              {totalPnl !== 0 && (
                <span className={`text-lg font-bold ${totalPnl > 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {totalPnl > 0 ? "+" : ""}{totalPnl.toFixed(0)}€
                </span>
              )}
            </div>
          )}
          <MobileMenu
            portfolio={portfolio}
            onUpdate={loadPortfolio}
            onCreateNew={() => setShowCreatePortfolio(true)}
            onDeleted={async () => {
              const p = await getActivePortfolio();
              setPortfolio(p);
            }}
            onEdit={() => setShowEditPortfolio(true)}
          />
        </div>
      </header>

      {/* Tab Bar – erst nach Laden zeigen */}
      {loaded && <div className="px-5 pt-4 pb-2">
        <div className="flex max-w-[200px] mx-auto rounded-[12px] bg-bg-secondary p-1 gap-1">
          <button
            onClick={() => setActiveTab("signals")}
            className={`flex-1 rounded-[6px] py-2 text-sm font-semibold text-center transition-colors ${
              activeTab === "signals"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-muted"
            }`}
          >
            Heute
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`flex-1 rounded-[6px] py-2 text-sm font-semibold text-center transition-colors relative ${
              activeTab === "trades"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-muted"
            }`}
          >
            Verlauf
            {openTradeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1">
                {openTradeCount}
              </span>
            )}
          </button>
        </div>
      </div>}

      {/* Pull-to-Refresh Indikator */}
      {(pullDistance > 0 || pullRefreshing) && (
        <div className="flex justify-center py-2" style={{ height: pullRefreshing ? 40 : pullDistance * 0.5 }}>
          <div className={`w-5 h-5 border-2 border-text-muted border-t-text-primary rounded-full ${pullRefreshing || pullDistance > 50 ? "animate-spin" : ""}`}
            style={{ opacity: Math.min(pullDistance / 50, 1) }}
          />
        </div>
      )}

      {/* Status Bar */}
      {statusBar && (
        <div className="px-5 w-full max-w-lg mx-auto pt-2">
          <div className="rounded-[12px] overflow-hidden flex">
            {/* AKTUELL — immer dunkel */}
            <div className="flex-1 bg-text-primary px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-0.5">Aktuell</p>
              <p className="text-sm font-bold text-white truncate">{statusBar.now.label}</p>
            </div>
            {/* NÄCHSTER SCHRITT — hell */}
            <div className="flex-1 bg-bg-secondary border border-border border-l-0 rounded-r-[12px] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted/50 mb-0.5">Nächster Schritt</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-text-primary truncate">{statusBar.next.label}</p>
                {statusBar.next.time && (
                  <span className="shrink-0 text-[11px] font-bold text-text-primary bg-bg-elevated px-2 py-0.5 rounded-full border border-border">
                    {statusBar.next.time}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main ref={mainRef} className="flex-1 px-5 py-6 w-full max-w-lg mx-auto space-y-6">
        {!loaded ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-8 h-8 border-2 border-text-muted border-t-text-primary rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold text-text-primary">Wird geladen…</p>
          </div>
        ) : activeTab === "signals" ? (
          <>
            {notifState === "prompt" && (
              <button
                onClick={async () => {
                  const granted = await requestPermission();
                  setNotifState(granted ? "granted" : "denied");
                  if (granted) {
                    // Push-Subscription beim Server registrieren
                    await subscribeToPush();
                    if (signals) {
                      for (const s of [signals.steady, signals.bold]) {
                        scheduleEntryNotification(s.id, s.asset, s.direction, s.leverage, s.entry, s.optimalEntry);
                      }
                    }
                  }
                }}
                className="flex items-center gap-2 w-full rounded-[12px] bg-bg-secondary px-4 py-3 text-left transition-colors hover:bg-bg-secondary/80"
              >
                <span className="text-base">🔔</span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Benachrichtigungen aktivieren</p>
                  <p className="text-xs text-text-muted">Einstiegsfenster & Schließen-Erinnerung</p>
                </div>
              </button>
            )}
            {riskMultiplier < 1.0 && (
              <div className="rounded-[12px] bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                <p className="text-sm font-semibold text-amber-500">Risiko-Bremse aktiv</p>
                <p className="text-xs text-amber-500/80 mt-0.5">3 Verluste in Folge — Positionen halbiert bis zum nächsten Gewinn.</p>
              </div>
            )}
            {signalsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-8 h-8 border-2 border-text-muted border-t-text-primary rounded-full animate-spin mb-4" />
                <p className="text-sm font-semibold text-text-primary">Signale werden generiert…</p>
                <p className="text-xs text-text-muted mt-1">
                  {isWeekend()
                    ? "12 Krypto-Assets werden analysiert."
                    : isXetraHoliday() && isNYSEHoliday()
                      ? "Forex & Krypto werden analysiert (Börsen + CME geschlossen)."
                      : isXetraHoliday()
                        ? "US, Forex, Rohstoffe & Krypto werden analysiert."
                        : isNYSEHoliday()
                          ? "EU, Forex, Rohstoffe & Krypto werden analysiert."
                          : "Marktdaten werden analysiert."}{" "}
                  Das kann bis zu 30 Sekunden dauern.
                </p>
              </div>
            ) : signalsWaitUntil ? (
              <div className="space-y-4">
                {scanCandidates && scanCandidates.length > 0 ? (
                  <>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-text-primary">Heute im Fokus</p>
                      <p className="text-xs text-text-muted mt-1">
                        Finale Signale ab {signalsWaitUntil} Uhr — London-NY-Overlap
                      </p>
                    </div>
                    {scanCandidates.map((c, i) => (
                      <div key={i} className="rounded-[12px] bg-bg-secondary px-4 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-text-primary">{c.asset}</span>
                            <span className="text-xs text-text-muted">{c.ticker}</span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            c.direction === "LONG"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-red-500/10 text-red-500"
                          }`}>
                            {c.direction}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
                          <span>{c.category}</span>
                          <span>{c.market}</span>
                          <span>Konfidenz: {c.confidence}%</span>
                        </div>
                        <p className="text-xs text-text-muted">{c.note}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="rounded-[12px] bg-bg-secondary px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-text-primary">Märkte laufen an...</p>
                    <p className="text-xs text-text-muted mt-1">
                      Finale Signale werden um {signalsWaitUntil} Uhr mit frischen Daten erstellt.
                    </p>
                  </div>
                )}
              </div>
            ) : signalsError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm font-semibold text-text-primary">Signale konnten nicht geladen werden</p>
                <p className="text-xs text-text-muted mt-1">{signalsError}</p>
                <button
                  onClick={loadSignals}
                  className="mt-4 rounded-[6px] bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
                >
                  Erneut versuchen
                </button>
              </div>
            ) : signals ? (
              <div className="space-y-4">
                {signals.steady.confidence >= 70 || openTradeSignals.has(signals.steady.id) ? (
                  <SignalCard signal={signals.steady} portfolio={portfolio} allocatedBudget={allocations[0]} onPortfolioUpdate={loadPortfolio} />
                ) : (
                  <div className="rounded-[12px] bg-bg-secondary px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-text-primary">Kein Steady-Signal heute</p>
                    <p className="text-xs text-text-muted mt-1">Konfidenz zu niedrig ({signals.steady.confidence}%). Mindestens 70% nötig.</p>
                  </div>
                )}
                {signals.bold.confidence >= 50 || openTradeSignals.has(signals.bold.id) ? (
                  <SignalCard signal={signals.bold} portfolio={portfolio} allocatedBudget={allocations[1]} onPortfolioUpdate={loadPortfolio} />
                ) : (
                  <div className="rounded-[12px] bg-bg-secondary px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-text-primary">Kein Bold-Signal heute</p>
                    <p className="text-xs text-text-muted mt-1">Konfidenz zu niedrig ({signals.bold.confidence}%). Mindestens 50% nötig.</p>
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : portfolio ? (
          <TradeHistory portfolio={portfolio} onPortfolioUpdate={loadPortfolio} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-semibold text-text-primary">Kein Portfolio aktiv</p>
            <p className="text-xs text-text-muted mt-1">
              Eröffne ein Portfolio um Trades zu tracken.
            </p>
          </div>
        )}
      </main>

      {/* Create Portfolio Modal */}
      {showCreatePortfolio && (
        <CreatePortfolio
          onCreated={() => {
            loadPortfolio();
            setShowCreatePortfolio(false);
          }}
          onCancel={() => setShowCreatePortfolio(false)}
        />
      )}

      {/* Edit Portfolio Modal */}
      {showEditPortfolio && portfolio && (
        <EditPortfolio
          portfolio={portfolio}
          onSaved={() => {
            loadPortfolio();
            setShowEditPortfolio(false);
          }}
          onDeleted={async () => {
            setShowEditPortfolio(false);
            const p = await getActivePortfolio();
            setPortfolio(p);
          }}
          onCancel={() => setShowEditPortfolio(false)}
        />
      )}
    </>
  );
}
