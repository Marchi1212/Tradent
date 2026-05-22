"use client";

import { useState, useEffect } from "react";
import type { Signal } from "@/lib/mock-signals";
import { getActivePortfolio, allocateCapital, type Portfolio } from "@/lib/portfolio-store";
import SignalCard from "./signal-card";
import TradeHistory from "./trade-history";
import CreatePortfolio from "./create-portfolio";
import PortfolioHeader from "./portfolio-header";
import SignOutButton from "@/app/sign-out-button";
import { isWeekend, isGermanHoliday } from "@/lib/market-hours";

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
  const [activeTab, setActiveTab] = useState<Tab>("signals");
  const [loaded, setLoaded] = useState(false);
  const [signals, setSignals] = useState<{ steady: Signal; bold: Signal } | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState<string | null>(null);

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
      if (data.signals?.steady && data.signals?.bold) {
        setSignals(data.signals);
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
  }, []);

  const allocations = portfolio && signals
    ? allocateCapital(portfolio.currentBalance, parseSignalInputs(signals))
    : [0, 0];

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-primary">
        <img src="/logo.svg" alt="Tradent" className="h-5" />
        <div className="flex items-center gap-3">
          {portfolio ? (
            <PortfolioHeader
              portfolio={portfolio}
              onUpdate={loadPortfolio}
              onCreateNew={() => setShowCreatePortfolio(true)}
              onDeleted={async () => {
                const p = await getActivePortfolio();
                setPortfolio(p);
              }}
            />
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
      </header>

      {/* Tab Bar – erst nach Laden zeigen */}
      {loaded && <div className="sticky top-[61px] z-20 bg-bg-primary px-5 pt-4 pb-2">
        <div className="flex max-w-[200px] mx-auto rounded-[12px] bg-bg-secondary p-1 gap-1">
          <button
            onClick={() => setActiveTab("signals")}
            className={`flex-1 rounded-[6px] py-2 text-sm font-semibold text-center transition-colors ${
              activeTab === "signals"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-muted"
            }`}
          >
            Signals
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`flex-1 rounded-[6px] py-2 text-sm font-semibold text-center transition-colors ${
              activeTab === "trades"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-muted"
            }`}
          >
            Journal
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
            <p className="text-sm text-text-muted">{today}</p>
            {signalsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-8 h-8 border-2 border-text-muted border-t-text-primary rounded-full animate-spin mb-4" />
                <p className="text-sm font-semibold text-text-primary">Signale werden generiert…</p>
                <p className="text-xs text-text-muted mt-1">
                  {isWeekend()
                    ? "12 Krypto-Assets werden analysiert."
                    : isGermanHoliday()
                      ? "US, Forex, Rohstoffe & Krypto werden analysiert."
                      : "55 Assets werden analysiert."}{" "}
                  Das kann bis zu 30 Sekunden dauern.
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
                <SignalCard signal={signals.steady} portfolio={portfolio} allocatedBudget={allocations[0]} />
                <SignalCard signal={signals.bold} portfolio={portfolio} allocatedBudget={allocations[1]} />
              </div>
            ) : null}
          </>
        ) : portfolio ? (
          <TradeHistory portfolioId={portfolio.id} />
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
    </>
  );
}
