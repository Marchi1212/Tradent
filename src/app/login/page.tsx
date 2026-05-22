"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email oder Passwort falsch.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
      <div className="w-full max-w-sm space-y-10">
        {/* Brand */}
        <div className="flex flex-col items-center">
          <img src="/logo.svg" alt="Tradent" className="h-6" />
          <p className="text-sm text-text-secondary mt-3">
            Dein täglicher Trading-Advisor
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm text-text-primary mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-[12px] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-text-muted"
              placeholder="name@email.de"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm text-text-primary mb-2"
            >
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-[12px] bg-bg-secondary border border-border px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-text-muted"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-negative">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[6px] bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? "Anmelden..." : "Anmelden"}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center">
          Zugang nur auf Einladung.
        </p>
      </div>
    </div>
  );
}
