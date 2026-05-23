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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
