"use client";

import { useState, useEffect } from "react";
import { todaySignals } from "@/lib/mock-signals";
import { getActivePortfolio, allocateCapital, type Portfolio } from "@/lib/portfolio-store";
import SignalCard from "./signal-card";
import TradeHistory from "./trade-history";
import CreatePortfolio from "./create-portfolio";
import PortfolioHeader from "./portfolio-header";
import SignOutButton from "@/app/sign-out-button";

type Tab = "signals" | "trades";

function parseSignalInputs(signals: typeof todaySignals) {
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

  async function loadPortfolio() {
    try {
      const p = await getActivePortfolio();
      setPortfolio(p);
    } catch (err) {
      console.error("Portfolio laden fehlgeschlagen:", err);
    }
  }

  useEffect(() => {
    loadPortfolio().then(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  // Kelly-basierte Kapitalaufteilung
  const signalInputs = parseSignalInputs(todaySignals);
  const allocations = portfolio
    ? allocateCapital(portfolio.currentBalance, signalInputs)
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

      {/* Tab Bar */}
      <div className="sticky top-[61px] z-20 bg-bg-primary px-5 pt-4 pb-2">
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
      </div>

      <main className="flex-1 px-5 py-6 w-full max-w-lg mx-auto space-y-6">
        {activeTab === "signals" ? (
          <>
            <p className="text-sm text-text-muted">{today}</p>
            <div className="space-y-4">
              <SignalCard signal={todaySignals.steady} portfolio={portfolio} allocatedBudget={allocations[0]} />
              <SignalCard signal={todaySignals.bold} portfolio={portfolio} allocatedBudget={allocations[1]} />
            </div>
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
