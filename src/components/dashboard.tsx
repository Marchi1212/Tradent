"use client";

import { useState, useEffect } from "react";
import type { Signal } from "@/lib/mock-signals";
import { getActivePortfolio, allocateCapital, getOpenTradeForSignal, type Portfolio } from "@/lib/portfolio-store";
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
        return;
      }
      if (data.signals?.steady && data.signals?.bold) {
        setSignals(data.signals);
        setSignalsWaitUntil(null);
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

  // Offene Trades prüfen (damit Karten trotz niedriger Konfidenz sichtbar bleiben)
  useEffect(() => {
    if (!signals || !portfolio) return;
    async function checkOpenTrades() {
      const openIds = new Set<string>();
      for (const s of [signals!.steady, signals!.bold]) {
        const trade = await getOpenTradeForSignal(portfolio!.id, s.id);
        if (trade) openIds.add(s.id);
      }
      setOpenTradeSignals(openIds);
    }
    checkOpenTrades();
  }, [signals, portfolio]);

  // Entry-Notifications schedulen sobald Signale geladen sind
  useEffect(() => {
    if (!signals || !hasPermission()) return;
    for (const s of [signals.steady, signals.bold]) {
      scheduleEntryNotification(s.id, s.asset, s.direction, s.leverage, s.entry, s.optimalEntry);
    }
  }, [signals]);

  // Allokation basiert auf Original-Budget (nicht currentBalance),
  // damit die Aufteilung fix bleibt wenn Position 1 schon offen ist
  const allocations = portfolio && signals
    ? allocateCapital(portfolio.budget, parseSignalInputs(signals))
    : [0, 0];

  const invested = portfolio ? Math.max(0, portfolio.budget - portfolio.currentBalance) : 0;

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
                {invested > 0 && (
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                    <span className="text-sm font-bold text-amber-500">{invested.toFixed(0)}€</span>
                  </div>
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
              {invested > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  <span className="text-lg font-bold text-amber-500">{invested.toFixed(0)}€</span>
                </div>
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
            Today
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`flex-1 rounded-[6px] py-2 text-sm font-semibold text-center transition-colors ${
              activeTab === "trades"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-muted"
            }`}
          >
            Trades
          </button>
        </div>
      </div>}

      <main className="flex-1 px-5 py-6 w-full max-w-lg mx-auto space-y-6">
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
            {signalsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-8 h-8 border-2 border-text-muted border-t-text-primary rounded-full animate-spin mb-4" />
                <p className="text-sm font-semibold text-text-primary">Signale werden generiert…</p>
                <p className="text-xs text-text-muted mt-1">
                  {isWeekend()
                    ? "12 Krypto-Assets werden analysiert."
                    : isXetraHoliday() && isNYSEHoliday()
                      ? "Forex, Rohstoffe & Krypto werden analysiert."
                      : isXetraHoliday()
                        ? "US, Forex, Rohstoffe & Krypto werden analysiert."
                        : isNYSEHoliday()
                          ? "EU, Forex, Rohstoffe & Krypto werden analysiert."
                          : "55 Assets werden analysiert."}{" "}
                  Das kann bis zu 30 Sekunden dauern.
                </p>
              </div>
            ) : signalsWaitUntil ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-2xl mb-4">⏳</p>
                <p className="text-sm font-semibold text-text-primary">Neue Signale ab {signalsWaitUntil} Uhr</p>
                <p className="text-xs text-text-muted mt-1">
                  Die Märkte müssen erst anlaufen, damit die Analyse zuverlässig ist.
                </p>
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
          <TradeHistory portfolio={portfolio} />
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
