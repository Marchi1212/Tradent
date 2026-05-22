"use client";

import { useState, useEffect, useRef } from "react";
import type { Portfolio } from "@/lib/portfolio-store";
import { getPortfolios, setActivePortfolio } from "@/lib/portfolio-store";

interface Props {
  portfolio: Portfolio;
  onUpdate: () => void;
  onCreateNew: () => void;
}

export default function PortfolioHeader({ portfolio, onUpdate, onCreateNew }: Props) {
  const [open, setOpen] = useState(false);
  const [allPortfolios, setAllPortfolios] = useState<Portfolio[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      getPortfolios().then(setAllPortfolios).catch(console.error);
    }
  }, [open]);

  // Dropdown schließen bei Klick außerhalb
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleSwitch(id: string) {
    try {
      await setActivePortfolio(id);
      setOpen(false);
      onUpdate();
    } catch (err) {
      console.error("Portfolio wechseln fehlgeschlagen:", err);
    }
  }

  const otherPortfolios = allPortfolios.filter((p) => p.id !== portfolio.id);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger – Feld-Style */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 bg-bg-secondary rounded-[6px] px-3 py-1.5"
      >
        <span className="text-sm font-bold text-text-primary">{portfolio.currentBalance.toFixed(0)}€</span>
        <span className="text-xs text-text-muted">{portfolio.name}</span>
        <svg
          className={`w-3 h-3 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-[12px] bg-bg-primary border border-border shadow-lg overflow-hidden z-50">
          {/* Aktives Portfolio */}
          <div className="px-4 py-3 bg-bg-secondary">
            <p className="text-xs text-text-muted">Aktives Depot</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">
              {portfolio.name} · {portfolio.currentBalance.toFixed(0)}€
            </p>
          </div>

          {/* Andere Portfolios */}
          {otherPortfolios.length > 0 && (
            <div className="border-t border-border">
              {otherPortfolios.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSwitch(p.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-bg-secondary transition-colors"
                >
                  <span className="text-text-primary font-medium">{p.name}</span>
                  <span className="text-text-muted">{p.currentBalance.toFixed(0)}€</span>
                </button>
              ))}
            </div>
          )}

          {/* Neues Depot */}
          <div className="border-t border-border">
            <button
              onClick={() => { setOpen(false); onCreateNew(); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Neues Depot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
