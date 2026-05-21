"use client";

import { todaySignals } from "@/lib/mock-signals";
import SignalCard from "./signal-card";

export default function Dashboard() {
  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="flex-1 px-5 py-8 w-full max-w-lg mx-auto space-y-6">
      {/* Date */}
      <p className="text-sm text-text-muted">{today}</p>

      {/* Two Signal Cards: Steady (light) + Bold (dark) */}
      <div className="space-y-4">
        <SignalCard signal={todaySignals.steady} />
        <SignalCard signal={todaySignals.bold} />
      </div>
    </main>
  );
}
