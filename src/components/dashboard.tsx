"use client";

import { todaySignals } from "@/lib/mock-signals";
import SignalCard from "./signal-card";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 17) return "Guten Tag";
  return "Guten Abend";
}

export default function Dashboard() {
  return (
    <main className="flex-1 px-5 py-6 w-full max-w-lg mx-auto space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-sm text-text-secondary">{getGreeting()}</p>
        <h1 className="text-xl font-semibold text-text-primary">
          Deine Signale für heute
        </h1>
      </div>

      {/* Two Signal Cards */}
      <div className="space-y-3">
        <SignalCard signal={todaySignals.steady} />
        <SignalCard signal={todaySignals.bold} />
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
