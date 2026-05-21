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
    <main className="flex-1 px-5 py-8 w-full max-w-lg mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-sm text-text-secondary">{getGreeting()}</p>
        <h1 className="text-2xl font-semibold text-text-primary mt-1">
          Deine Signale für heute
        </h1>
      </div>

      {/* Two Signal Cards */}
      <div className="space-y-4">
        <SignalCard signal={todaySignals.steady} />
        <SignalCard signal={todaySignals.bold} />
      </div>
    </main>
  );
}
