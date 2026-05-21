"use client";

import { useState } from "react";
import { mockSignals, type RiskClass } from "@/lib/mock-signals";
import SignalCard from "./signal-card";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 17) return "Guten Tag";
  return "Guten Abend";
}

type Filter = "all" | RiskClass;

export default function Dashboard() {
  const [filter, setFilter] = useState<Filter>("all");

  const filteredSignals =
    filter === "all"
      ? mockSignals
      : mockSignals.filter((s) => s.riskClass === filter);

  const steadyCount = mockSignals.filter((s) => s.riskClass === "steady").length;
  const boldCount = mockSignals.filter((s) => s.riskClass === "bold").length;

  return (
    <main className="flex-1 px-5 py-6 w-full max-w-lg mx-auto space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-sm text-text-secondary">{getGreeting()}</p>
        <h1 className="text-xl font-semibold text-text-primary">
          Deine Signale für heute
        </h1>
      </div>

      {/* Filter Toggle */}
      <div className="flex gap-1.5 p-1 rounded-[--radius-md] bg-bg-card border border-border">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 rounded-[--radius-sm] py-2 text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-accent text-white font-semibold"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Alle ({mockSignals.length})
        </button>
        <button
          onClick={() => setFilter("steady")}
          className={`flex-1 rounded-[--radius-sm] py-2 text-xs font-medium transition-colors ${
            filter === "steady"
              ? "bg-accent text-white font-semibold"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Steady ({steadyCount})
        </button>
        <button
          onClick={() => setFilter("bold")}
          className={`flex-1 rounded-[--radius-sm] py-2 text-xs font-medium transition-colors ${
            filter === "bold"
              ? "bg-accent text-white font-semibold"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Bold ({boldCount})
        </button>
      </div>

      {/* Signal Cards */}
      <div className="space-y-3">
        {filteredSignals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[--radius-md] bg-bg-card border border-border p-3">
          <p className="text-[10px] text-text-muted uppercase">Trefferquote</p>
          <p className="text-lg font-semibold text-text-primary mt-0.5">68%</p>
        </div>
        <div className="rounded-[--radius-md] bg-bg-card border border-border p-3">
          <p className="text-[10px] text-text-muted uppercase">Aktive Trades</p>
          <p className="text-lg font-semibold text-text-primary mt-0.5">0</p>
        </div>
        <div className="rounded-[--radius-md] bg-bg-card border border-border p-3">
          <p className="text-[10px] text-text-muted uppercase">Heute</p>
          <p className="text-lg font-semibold text-positive mt-0.5">+0€</p>
        </div>
      </div>
    </main>
  );
}
