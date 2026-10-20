import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FullPageLoader } from "@/components/FullPageLoader";
import { Logo } from "@/components/Logo";
import { DisplayTitle, MetaRow } from "@/components/gallery";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Glass-aesthetic input treatment for the auth cards (overrides solid bg-deep). */
const glassInput =
  "bg-white/[0.08] border-white/25 text-bone placeholder:text-ash/80 shadow-none ring-offset-transparent focus-visible:border-cyan/60 focus-visible:ring-cyan/35";

export function LoginPage() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const homeFor = (role: string): string =>
    role === "ADMIN" ? "/app/admin" : role === "TEACHER" ? "/app/teacher" : "/app/map";

  if (status === "loading") return <FullPageLoader />;
  if (status === "authenticated") return <Navigate to={user ? homeFor(user.role) : "/app"} replace />;

  const from = (location.state as { from?: string } | null)?.from;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await login({ email, password });
      const target = from && from !== "/app" ? from : homeFor(session.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-bone lg:flex-row">
      {/* Full-viewport Celestial Island Cityscape — the page background. */}
      <div aria-hidden className="auth-backdrop absolute inset-0 -z-20" />
      {/* Subtle left-edge gradient for branding readability only — no full dark panel. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(3,18,26,0.78)_0%,rgba(3,18,26,0.45)_26%,rgba(3,18,26,0.12)_50%,rgba(3,18,26,0.04)_100%)]"
      />

      {/* Branding over the image — left side. */}
      <aside className="relative flex flex-1 flex-col justify-between px-6 py-8 sm:px-10 lg:min-h-screen lg:w-[52%] lg:px-14 lg:py-12">
        <header className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="font-display text-sm font-medium tracking-[0.28em] text-bone">ECOSPHERE</span>
        </header>

        <div className="max-w-xl animate-gallery-rise pb-8 lg:pb-0">
          <p className="flex items-center gap-3 font-micro text-[11px] uppercase tracking-[0.34em] text-cyan">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-cyan animate-pulse-glow" />
            Sign in to continue
          </p>
          <DisplayTitle lines={["EXPLORE.", "LEARN.", "PROTECT."]} className="mt-5" />
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ash">
            Turn real-world environmental action into an adventure. Pick up your quests, coursework and
            rewards exactly where you left them.
          </p>
          <MetaRow className="mt-8">
            <span>Real-world quests</span>
            <span>XP &amp; badges</span>
            <span>Assignments &amp; quizzes</span>
          </MetaRow>
        </div>
      </aside>

      {/* Glass login card — right side, landscape visible through it. */}
      <main className="relative flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:w-[48%] lg:px-12 lg:py-12">
        <div className="animate-gallery-rise mx-auto w-full max-w-md">
          <div className="auth-glass rounded-[18px] p-7 sm:p-9">
            <p className="font-micro text-[10px] uppercase tracking-[0.28em] text-emerald">
              <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_10px_rgba(46,207,143,0.9)]" />
              Explorer access
            </p>
            <h1 className="mt-3 font-display text-[32px] font-medium leading-[1.05] tracking-tight text-bone">
              Welcome back
            </h1>

            <div className="gallery-rule mt-6 pt-6">
              <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={glassInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={glassInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </div>

            <p className="mt-6 font-micro text-[10px] uppercase tracking-[0.14em] text-ash">
              No account?{" "}
              <Link to="/register" className="text-cyan underline-offset-4 hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
