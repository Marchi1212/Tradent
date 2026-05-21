import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      <Dashboard />

      {/* Footer */}
      <footer className="px-5 py-6 border-t border-border">
        <p className="text-xs text-text-muted text-center">
          Keine Anlageberatung · Nur zur persönlichen Nutzung
        </p>
      </footer>
    </div>
  );
}
