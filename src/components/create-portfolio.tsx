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
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !budget || saving) return;

    setSaving(true);
    try {
      await createPortfolio({
        name,
        budget: parseFloat(budget),
        riskSteady: 0,
        riskBold: 0,
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
      <div className="relative w-full max-w-sm bg-bg-primary rounded-t-[16px] sm:rounded-[16px] p-6 max-h-[85vh] overflow-y-auto">
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
              className="w-full rounded-[12px] bg-bg-secondary border border-border px-4 py-3.5 text-base sm:text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-text-muted"
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
                className="w-full rounded-[12px] bg-bg-secondary border border-border px-4 py-3.5 text-base sm:text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-text-muted pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              Die Positionsgröße wird automatisch per Kelly-Formel berechnet.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[6px] bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Wird erstellt..." : "Portfolio eröffnen"}
          </button>
        </form>
      </div>
    </div>
  );
}
