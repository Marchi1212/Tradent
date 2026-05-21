"use client";

import { useState } from "react";
import type { Session } from "@/lib/session-store";
import { updateSession } from "@/lib/session-store";

interface Props {
  session: Session;
  onUpdate: () => void;
}

export default function SessionHeader({ session, onUpdate }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [name, setName] = useState(session.name);
  const [riskSteady, setRiskSteady] = useState(String(session.riskSteady));
  const [riskBold, setRiskBold] = useState(String(session.riskBold));

  function handleSave() {
    updateSession(session.id, {
      name,
      riskSteady: parseFloat(riskSteady),
      riskBold: parseFloat(riskBold),
    });
    setShowSettings(false);
    onUpdate();
  }

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        className="flex items-center gap-2 text-right"
      >
        <div>
          <p className="text-sm font-bold text-text-primary">
            {session.currentBalance.toFixed(0)}€
          </p>
          <p className="text-[11px] text-text-muted">{session.name}</p>
        </div>
        <svg
          className="w-4 h-4 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative w-full max-w-sm bg-bg-primary rounded-t-[--radius-xl] sm:rounded-[--radius-xl] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-text-primary">
                Session bearbeiten
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-text-muted hover:text-text-secondary"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3 text-sm text-text-primary outline-none focus:border-text-muted"
              />
            </div>

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
                    className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3 text-sm text-text-primary outline-none focus:border-text-muted pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">%</span>
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
                    className="w-full rounded-[--radius-md] bg-bg-secondary border border-border px-4 py-3 text-sm text-text-primary outline-none focus:border-text-muted pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">%</span>
                </div>
              </div>
            </div>

            <div className="rounded-[--radius-md] bg-bg-secondary p-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Startbudget</span>
                <span className="font-semibold">{session.budget.toFixed(0)}€</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">Aktuell</span>
                <span className="font-bold">{session.currentBalance.toFixed(0)}€</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full rounded-[--radius-md] bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              Speichern
            </button>
          </div>
        </div>
      )}
    </>
  );
}
