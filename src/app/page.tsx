import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import Dashboard from "@/components/dashboard";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b border-border bg-bg-primary/95 backdrop-blur-sm">
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

      {/* Dashboard Content */}
      <Dashboard />

      {/* Footer */}
      <footer className="px-5 py-4 border-t border-border">
        <p className="text-[11px] text-text-muted text-center">
          Keine Anlageberatung · Nur zur persönlichen Nutzung
        </p>
      </footer>
    </div>
  );
}
