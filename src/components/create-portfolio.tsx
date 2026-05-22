"use client";

import { useState } from "react";
import { createPortfolio } from "@/lib/portfolio-store";

interface Props {
  onCreated: () => void;
  onCancel?: () => void;
}

export default function CreatePortfolio({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [riskSteady, setRiskSteady] = useState("2");
  const [riskBold, setRiskBold] = useState("5");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !budget || saving) return;

    setSaving(true);
    try {
      await createPortfolio({
        name,
        budget: parseFloat(budget),
        riskSteady: parseFloat(riskSteady),
        riskBold: parseFloat(riskBold),
      });
      onCreated();
    } catch (err) {
      console.error("Portfolio erstellen fehlgeschlagen:", err);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-bg-primary rounded-t-[--radius-xl] sm:rounded-[--radius-xl] p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-text-primary">
            Portfolio eröffnen
          </h2>
          {onCancel && (
            <button onClick={onCancel} className="text-text-muted hover:text-text-secondary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Test Mai"
              required
              className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-text-muted"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Budget</label>
            <div className="relative">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="200"
                required
                min="1"
                className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-text-muted pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Risiko Steady</label>
              <div className="relative">
                <input
                  type="number"
                  value={riskSteady}
                  onChange={(e) => setRiskSteady(e.target.value)}
                  min="0.5" max="10" step="0.5"
                  className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary outline-none focus:border-text-muted pr-10"
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
                  className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary outline-none focus:border-text-muted pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">%</span>
              </div>
            </div>
          </div>

          {budget && (
            <div className="rounded-[--radius-md] bg-bg-secondary p-4 space-y-2">
              <p className="text-[11px] text-text-muted uppercase font-semibold">Vorschau</p>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Max. Verlust Steady</span>
                <span className="font-semibold">{(parseFloat(budget) * parseFloat(riskSteady || "0") / 100).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Max. Verlust Bold</span>
                <span className="font-semibold">{(parseFloat(budget) * parseFloat(riskBold || "0") / 100).toFixed(2)}€</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[--radius-md] bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Wird erstellt..." : "Portfolio eröffnen"}
          </button>
        </form>
      </div>
    </div>
  );
}
