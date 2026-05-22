"use client";

import { useState, useEffect } from "react";
import { todaySignals } from "@/lib/mock-signals";
import { getActivePortfolio, type Portfolio } from "@/lib/portfolio-store";
import SignalCard from "./signal-card";
import CreatePortfolio from "./create-portfolio";
import PortfolioHeader from "./portfolio-header";
import SignOutButton from "@/app/sign-out-button";

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
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
        <span className="text-base font-bold text-text-primary">Tradent</span>
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
              className="rounded-[--radius-md] bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              Portfolio eröffnen
            </button>
          )}
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-5 py-8 w-full max-w-lg mx-auto space-y-6">
        <p className="text-sm text-text-muted">{today}</p>

        <div className="space-y-4">
          <SignalCard signal={todaySignals.steady} portfolio={portfolio} />
          <SignalCard signal={todaySignals.bold} portfolio={portfolio} />
        </div>
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
