"use client";

import { useState } from "react";
import { createSession } from "@/lib/session-store";

interface Props {
  onCreated: () => void;
}

export default function CreateSession({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [riskSteady, setRiskSteady] = useState("2");
  const [riskBold, setRiskBold] = useState("5");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !budget) return;

    createSession({
      name,
      budget: parseFloat(budget),
      riskSteady: parseFloat(riskSteady),
      riskBold: parseFloat(riskBold),
    });

    onCreated();
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-black text-text-primary mb-2">
          Session starten
        </h2>
        <p className="text-sm text-text-secondary mb-8">
          Erstelle eine Trading-Session um deine Trades zu tracken.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Test Mai"
              required
              className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-text-muted"
            />
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Budget
            </label>
            <div className="relative">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="200"
                required
                min="1"
                className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-text-muted pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                €
              </span>
            </div>
          </div>

          {/* Risk Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Risiko Steady
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={riskSteady}
                  onChange={(e) => setRiskSteady(e.target.value)}
                  min="0.5"
                  max="10"
                  step="0.5"
                  className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary outline-none transition-colors focus:border-text-muted pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                  %
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Risiko Bold
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={riskBold}
                  onChange={(e) => setRiskBold(e.target.value)}
                  min="0.5"
                  max="10"
                  step="0.5"
                  className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary outline-none transition-colors focus:border-text-muted pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Preview */}
          {budget && (
            <div className="rounded-[--radius-md] bg-bg-secondary p-4 space-y-2">
              <p className="text-[11px] text-text-muted uppercase font-semibold">Vorschau</p>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Max. Verlust Steady</span>
                <span className="font-semibold text-text-primary">
                  {(parseFloat(budget) * parseFloat(riskSteady || "0") / 100).toFixed(2)}€
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Max. Verlust Bold</span>
                <span className="font-semibold text-text-primary">
                  {(parseFloat(budget) * parseFloat(riskBold || "0") / 100).toFixed(2)}€
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-[--radius-md] bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
          >
            Session starten
          </button>
        </form>
      </div>
    </div>
  );
}
