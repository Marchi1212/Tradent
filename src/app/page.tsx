import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-sm font-bold text-white">T</span>
          </div>
          <span className="text-base font-semibold text-text-primary">
            Tradent
          </span>
        </div>
        <SignOutButton />
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 py-6 w-full max-w-lg mx-auto space-y-5">
        {/* Greeting */}
        <div>
          <p className="text-sm text-text-secondary">Guten Morgen</p>
          <h1 className="text-xl font-semibold text-text-primary">
            Deine Signale für heute
          </h1>
        </div>

        {/* Risk Class Toggle */}
        <div className="flex gap-2 p-1 rounded-[--radius-md] bg-bg-card border border-border">
          <button className="flex-1 rounded-[--radius-sm] bg-accent py-2 text-xs font-semibold text-white">
            Klasse A
          </button>
          <button className="flex-1 rounded-[--radius-sm] py-2 text-xs font-medium text-text-muted transition-colors hover:text-text-secondary">
            Klasse B
          </button>
        </div>

        {/* Signal Card */}
        <div className="rounded-[--radius-lg] bg-bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
              Signal #1
            </span>
            <span className="inline-flex items-center rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-medium text-positive">
              LONG
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center text-sm font-semibold text-text-primary">
              DA
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-text-primary">
                DAX 40
              </p>
              <p className="text-xs text-text-secondary">
                Index · Kein Hebel
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-positive">+2.4%</p>
              <p className="text-[11px] text-text-muted">Chance 1:2</p>
            </div>
          </div>

          {/* Entry / SL / TP */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">Einstieg</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">
                18.450
              </p>
            </div>
            <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">
                Stop-Loss
              </p>
              <p className="text-sm font-medium text-negative mt-0.5">
                18.265
              </p>
            </div>
            <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase">
                Take-Profit
              </p>
              <p className="text-sm font-medium text-positive mt-0.5">
                18.820
              </p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="rounded-[--radius-sm] bg-bg-elevated px-3 py-2.5">
            <p className="text-[10px] text-text-muted uppercase mb-1">
              Begründung
            </p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Technische Analyse zeigt bullishes Momentum über dem 50-Tage-EMA.
              RSI bei 58 mit Aufwärtstrend. Geopolitische Lage stabil.
            </p>
          </div>
        </div>

        {/* Placeholder second card */}
        <div className="rounded-[--radius-lg] bg-bg-card border border-border border-dashed p-8 flex items-center justify-center">
          <p className="text-sm text-text-muted">
            Weitere Signale werden geladen...
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[--radius-md] bg-bg-card border border-border p-4">
            <p className="text-[11px] text-text-muted uppercase">
              Trefferquote
            </p>
            <p className="text-xl font-semibold text-text-primary mt-1">68%</p>
          </div>
          <div className="rounded-[--radius-md] bg-bg-card border border-border p-4">
            <p className="text-[11px] text-text-muted uppercase">
              Offene Trades
            </p>
            <p className="text-xl font-semibold text-text-primary mt-1">3</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-5 py-4 border-t border-border">
        <p className="text-[11px] text-text-muted text-center">
          Keine Anlageberatung · Nur zur persönlichen Nutzung
        </p>
      </footer>
    </div>
  );
}
