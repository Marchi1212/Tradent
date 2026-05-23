"use client";

import { useState } from "react";
import { updatePortfolio, deletePortfolio, type Portfolio } from "@/lib/portfolio-store";

interface Props {
  portfolio: Portfolio;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

export default function EditPortfolio({ portfolio, onSaved, onDeleted, onCancel }: Props) {
  const [name, setName] = useState(portfolio.name);
  const [budget, setBudget] = useState(String(portfolio.budget));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !budget || saving) return;

    setSaving(true);
    try {
      const newBudget = parseFloat(budget);
      const budgetDiff = newBudget - portfolio.budget;

      await updatePortfolio(portfolio.id, {
        name,
        budget: newBudget,
        // Balance proportional anpassen wenn Budget geändert wird
        currentBalance: portfolio.currentBalance + budgetDiff,
      });
      onSaved();
    } catch (err) {
      console.error("Portfolio aktualisieren fehlgeschlagen:", err);
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deletePortfolio(portfolio.id);
      onDeleted();
    } catch (err) {
      console.error("Portfolio löschen fehlgeschlagen:", err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-bg-primary rounded-t-[16px] sm:rounded-[16px] p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-text-primary">
            Depot bearbeiten
          </h2>
          <button onClick={onCancel} className="text-text-muted hover:text-text-secondary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
            <label className="block text-sm font-semibold text-text-primary mb-2">Depotgröße</label>
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
              Aktuelles Guthaben: {portfolio.currentBalance.toFixed(2)}€
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[6px] bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Wird gespeichert..." : "Speichern"}
          </button>
        </form>

        {/* Depot löschen */}
        <div className="mt-8 pt-5 border-t border-border">
          {confirmDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-text-primary font-semibold">Depot wirklich löschen?</p>
              <p className="text-xs text-text-muted">
                Alle Trades in diesem Depot werden ebenfalls gelöscht. Das kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-[6px] bg-red-500 py-3 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? "Wird gelöscht..." : "Ja, löschen"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-[6px] border border-border py-3 text-sm font-bold text-text-primary transition-colors hover:bg-bg-secondary"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-500 transition-colors hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Depot löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
