"use client";

import { useState } from "react";
import type { Portfolio } from "@/lib/portfolio-store";
import { updatePortfolio, getPortfolios, setActivePortfolio } from "@/lib/portfolio-store";

interface Props {
  portfolio: Portfolio;
  onUpdate: () => void;
  onCreateNew: () => void;
}

export default function PortfolioHeader({ portfolio, onUpdate, onCreateNew }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [riskSteady, setRiskSteady] = useState(String(portfolio.riskSteady));
  const [riskBold, setRiskBold] = useState(String(portfolio.riskBold));

  const allPortfolios = getPortfolios();

  function handleSave() {
    updatePortfolio(portfolio.id, {
      name,
      riskSteady: parseFloat(riskSteady),
      riskBold: parseFloat(riskBold),
    });
    setShowSettings(false);
    onUpdate();
  }

  function handleSwitch(id: string) {
    setActivePortfolio(id);
    setShowSettings(false);
    onUpdate();
  }

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        className="flex items-center gap-2"
      >
        <div className="text-right">
          <p className="text-sm font-bold text-text-primary">
            {portfolio.currentBalance.toFixed(0)}€
          </p>
          <p className="text-[11px] text-text-muted">{portfolio.name}</p>
        </div>
        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-sm bg-bg-primary rounded-t-[--radius-xl] sm:rounded-[--radius-xl] p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-text-primary">Portfolio</h3>
              <button onClick={() => setShowSettings(false)} className="text-text-muted hover:text-text-secondary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Balance */}
            <div className="rounded-[--radius-md] bg-bg-secondary p-4">
              <p className="text-[11px] text-text-muted uppercase mb-1">Kontostand</p>
              <p className="text-2xl font-black text-text-primary">{portfolio.currentBalance.toFixed(0)}€</p>
              <p className="text-xs text-text-muted mt-1">
                Startbudget: {portfolio.budget.toFixed(0)}€
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3 text-sm text-text-primary outline-none focus:border-text-muted"
              />
            </div>

            {/* Risk Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Risiko Steady</label>
                <div className="relative">
                  <input
                    type="number"
                    value={riskSteady}
                    onChange={(e) => setRiskSteady(e.target.value)}
                    min="0.5" max="10" step="0.5"
                    className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3 text-sm text-text-primary outline-none focus:border-text-muted pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Risiko Bold</label>
                <div className="relative">
                  <input
                    type="number"
                    value={riskBold}
                    onChange={(e) => setRiskBold(e.target.value)}
                    min="0.5" max="10" step="0.5"
                    className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3 text-sm text-text-primary outline-none focus:border-text-muted pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">%</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full rounded-[--radius-md] bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              Speichern
            </button>

            {/* Andere Portfolios */}
            {allPortfolios.length > 1 && (
              <div className="pt-4 border-t border-border">
                <p className="text-[11px] text-text-muted uppercase mb-2">Portfolios wechseln</p>
                <div className="space-y-1">
                  {allPortfolios
                    .filter((p) => p.id !== portfolio.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSwitch(p.id)}
                        className="w-full flex items-center justify-between rounded-[--radius-sm] px-3 py-2.5 text-sm hover:bg-bg-secondary transition-colors"
                      >
                        <span className="text-text-primary font-medium">{p.name}</span>
                        <span className="text-text-muted">{p.currentBalance.toFixed(0)}€</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Neues Portfolio */}
            <button
              onClick={() => { setShowSettings(false); onCreateNew(); }}
              className="w-full rounded-[--radius-md] border border-border py-3 text-sm font-semibold text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
            >
              Neues Portfolio eröffnen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
