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
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 bg-bg-secondary rounded-[6px] px-3.5 py-2"
      >
        <span className="text-sm text-text-primary">{portfolio.name}</span>
        <span className="text-sm font-bold text-text-primary">{portfolio.currentBalance.toFixed(0)}€</span>
        <svg
          className={`w-3 h-3 text-text-primary transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 15.4L6 9.4L7.4 8L12 12.575L16.6 8L18 9.4L12 15.4Z" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-[12px] bg-bg-primary border border-border shadow-lg overflow-hidden z-50">
          {/* Andere Portfolios */}
          {otherPortfolios.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSwitch(p.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-bg-secondary transition-colors"
            >
              <span className="text-text-primary">{p.name}</span>
              <span className="font-bold text-text-primary">{p.currentBalance.toFixed(0)}€</span>
            </button>
          ))}

          {/* Neues Depot */}
          <div className={otherPortfolios.length > 0 ? "border-t border-border" : ""}>
            <button
              onClick={() => { setOpen(false); onCreateNew(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
