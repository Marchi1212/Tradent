"use client";

import { useState, useEffect } from "react";
import { todaySignals } from "@/lib/mock-signals";
import { getActivePortfolio, type Portfolio } from "@/lib/portfolio-store";
import SignalCard from "./signal-card";
import TradeHistory from "./trade-history";
import CreatePortfolio from "./create-portfolio";
import PortfolioHeader from "./portfolio-header";
import SignOutButton from "@/app/sign-out-button";

type Tab = "signals" | "trades";

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

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-primary">
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
              className="rounded-[--radius-btn] bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              Portfolio eröffnen
            </button>
          )}
          <SignOutButton />
        </div>
      </header>

      {/* Tab Bar */}
      <div className="sticky top-[61px] z-10 bg-bg-primary px-5 pt-4 pb-2">
        <div className="flex max-w-lg mx-auto rounded-[--radius-md] bg-bg-secondary p-1 gap-1">
          <button
            onClick={() => setActiveTab("signals")}
            className={`flex-1 rounded-[--radius-btn] py-2 text-sm font-semibold text-center transition-colors ${
              activeTab === "signals"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-muted"
            }`}
          >
            Signals
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`flex-1 rounded-[--radius-btn] py-2 text-sm font-semibold text-center transition-colors ${
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
              <SignalCard signal={todaySignals.steady} portfolio={portfolio} />
              <SignalCard signal={todaySignals.bold} portfolio={portfolio} />
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
