"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Portfolio } from "@/lib/portfolio-store";
import { getPortfolios, setActivePortfolio } from "@/lib/portfolio-store";
import SignOutButton from "@/app/sign-out-button";

interface Props {
  portfolio: Portfolio | null;
  onUpdate: () => void;
  onCreateNew: () => void;
  onDeleted: () => void;
  onEdit: () => void;
}

export default function MobileMenu({ portfolio, onUpdate, onCreateNew, onDeleted, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [allPortfolios, setAllPortfolios] = useState<Portfolio[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && portfolio) {
      getPortfolios().then(setAllPortfolios).catch(console.error);
    }
  }, [open, portfolio]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const otherPortfolios = portfolio
    ? allPortfolios.filter((p) => p.id !== portfolio.id)
    : [];

  return (
    <>
      {/* Burger Icon */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="p-1 text-text-primary"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>

      {/* Menu Panel via Portal */}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed top-[53px] left-0 right-0 bg-bg-primary border-b border-border shadow-lg z-[9999]"
        >
          {/* Aktives Portfolio + Bearbeiten */}
          {portfolio && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <p className="text-[11px] text-text-muted uppercase">Aktives Depot</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{portfolio.name}</p>
              </div>
              <button
                onClick={() => { setOpen(false); onEdit(); }}
                className="p-2 text-text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            </div>
          )}

          {/* Andere Portfolios */}
          {otherPortfolios.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSwitch(p.id)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-bg-secondary transition-colors"
            >
              <span className="text-text-primary">{p.name}</span>
              <span className="font-bold text-text-primary">{p.currentBalance.toFixed(0)}€</span>
            </button>
          ))}

          {/* Neues Depot */}
          <button
            onClick={() => { setOpen(false); onCreateNew(); }}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-text-primary hover:bg-bg-secondary transition-colors border-t border-border"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Neues Depot
          </button>

          {/* Abmelden */}
          <div className="border-t border-border">
            <SignOutButton variant="menu" />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
