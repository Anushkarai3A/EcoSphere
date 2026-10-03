import { Logo } from "./Logo";

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-live="polite" role="status">
      <Logo className="h-16 w-16 animate-bounce drop-shadow-[0_0_20px_rgba(16,185,129,0.55)]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
