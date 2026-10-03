import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FullPageLoader } from "@/components/FullPageLoader";
import { Logo } from "@/components/Logo";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
    <div className="flex min-h-screen flex-col bg-void px-5 pb-10 text-bone sm:px-10">
      <header className="flex h-10 items-center gap-2">
        <Logo className="h-5 w-5" />
        <span className="font-display text-sm font-normal tracking-[0.08em]">ECOSPHERE</span>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-10 py-10">
        <div className="animate-gallery-rise">
          <p className="font-micro text-[11px] uppercase text-ash">Sign in to continue</p>
          <h1 className="mt-4 text-gallery-display text-white">
            <span className="block"><span className="gallery-underline">WELCOME</span></span>
            <span className="block"><span className="gallery-underline">BACK</span></span>
          </h1>
        </div>
        <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="font-micro text-[11px] text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="font-micro text-[11px] uppercase text-ash">
          No account?{" "}
          <Link to="/register" className="text-white underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </main>
    </div>
  );
}
