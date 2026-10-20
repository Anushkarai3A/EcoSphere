import { Logo } from "./Logo";

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-live="polite" role="status">
      <Logo className="h-16 w-16 animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
