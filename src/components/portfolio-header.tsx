"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Portfolio } from "@/lib/portfolio-store";
import { getPortfolios, setActivePortfolio } from "@/lib/portfolio-store";

interface Props {
  portfolio: Portfolio;
  onUpdate: () => void;
  onCreateNew: () => void;
  onDeleted: () => void;
  onEdit: () => void;
}

export default function PortfolioHeader({ portfolio, onUpdate, onCreateNew, onDeleted, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [allPortfolios, setAllPortfolios] = useState<Portfolio[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      getPortfolios().then(setAllPortfolios).catch(console.error);
      updatePosition();
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleScroll() {
      updatePosition();
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updatePosition]);

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
    <>
      {/* Trigger: Name + Chevron */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-bg-secondary rounded-[6px] px-3.5 py-2"
      >
        <span className="text-sm text-text-primary">{portfolio.name}</span>
        <svg
          className={`w-3 h-3 text-text-primary transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 15.4L6 9.4L7.4 8L12 12.575L16.6 8L18 9.4L12 15.4Z" />
        </svg>
      </button>

      {/* Edit-Button (Stift-Icon) */}
      <button
        onClick={onEdit}
        className="p-2 text-text-primary transition-colors"
        title="Depot bearbeiten"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Dropdown via Portal */}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="w-56 rounded-[12px] bg-bg-primary border border-border shadow-lg overflow-hidden"
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
          }}
        >
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
        </div>,
        document.body
      )}
    </>
  );
}
