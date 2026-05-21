"use client";

import { useState, useEffect } from "react";
import { todaySignals } from "@/lib/mock-signals";
import { getActiveSession, type Session } from "@/lib/session-store";
import SignalCard from "./signal-card";
import CreateSession from "./create-session";
import SessionHeader from "./session-header";
import SignOutButton from "@/app/sign-out-button";

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  function loadSession() {
    setSession(getActiveSession());
  }

  useEffect(() => {
    loadSession();
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  // Keine Session → Session erstellen
  if (!session) {
    return (
      <>
        <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-primary">
          <span className="text-base font-bold text-text-primary">Tradent</span>
          <SignOutButton />
        </header>
        <CreateSession onCreated={loadSession} />
      </>
    );
  }

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      {/* Header mit Session Info */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-primary">
        <span className="text-base font-bold text-text-primary">Tradent</span>
        <SessionHeader session={session} onUpdate={loadSession} />
      </header>

      <main className="flex-1 px-5 py-8 w-full max-w-lg mx-auto space-y-6">
        <p className="text-sm text-text-muted">{today}</p>

        <div className="space-y-4">
          <SignalCard signal={todaySignals.steady} session={session} />
          <SignalCard signal={todaySignals.bold} session={session} />
        </div>
      </main>
    </>
  );
}
