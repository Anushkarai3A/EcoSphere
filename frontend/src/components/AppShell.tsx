import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { WorldBackground } from "./ecosphere/WorldBackground";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

/** Game-style nav item: mono label, emerald underline indicator on hover/active. */
const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    "group relative inline-flex whitespace-nowrap px-3.5 py-2.5 font-micro text-[11px] uppercase tracking-[0.1em] transition-colors",
    isActive ? "text-bone" : "text-ash hover:text-bone",
  );

function NavIndicator({ isActive }: { isActive: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-2 -bottom-0.5 h-px origin-left scale-x-0 bg-gradient-to-r from-emerald to-cyan transition-transform duration-300 group-hover:scale-x-100",
        isActive && "scale-x-100",
      )}
    />
  );
}

interface AppShellProps {
  /** Full-bleed layout (no max-width / page padding) — used by the quest map. */
  fluid?: boolean;
  className?: string;
}

/** Route layout shell: renders the app header and an <Outlet/> for the page body. */
export function AppShell({ fluid = false, className }: AppShellProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links =
    user?.role === "ADMIN" ? (
      <NavLink to="/app/admin" className={navLinkClass} end>
        {({ isActive }) => (
          <>
            Dashboard
            <NavIndicator isActive={isActive} />
          </>
        )}
      </NavLink>
    ) : user?.role === "TEACHER" ? (
      <>
        <NavLink to="/app/teacher" className={navLinkClass} end>
          {({ isActive }) => (
            <>
              Dashboard
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/teacher/quests" className={navLinkClass}>
          {({ isActive }) => (
            <>
              My quests
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/teacher/assignments" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Assignments
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/teacher/quizzes" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Quiz studio
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/teacher/review" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Review
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/teacher/profile" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Profile
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
      </>
    ) : (
      <>
        <NavLink to="/app/student-dashboard" className={navLinkClass} end>
          {({ isActive }) => (
            <>
              Dashboard
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/student" className={navLinkClass} end>
          {({ isActive }) => (
            <>
              Quests
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/map" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Map
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/student/assignments" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Assignments
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/student/quizzes" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Quizzes
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/student/animation-studio" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Studio
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/student/leaderboard" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Leaderboard
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
        <NavLink to="/app/student/profile" className={navLinkClass}>
          {({ isActive }) => (
            <>
              Profile
              <NavIndicator isActive={isActive} />
            </>
          )}
        </NavLink>
      </>
    );

  return (
    <div className="flex min-h-screen flex-col text-bone">
      <WorldBackground />
      <header className="glass-strong sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="EcoSphere home">
            <Logo className="h-6 w-6" />
            <span className="font-title text-[14px] font-semibold uppercase tracking-[0.22em] text-bone">
              EcoSphere
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="mx-auto hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex"
          >
            {links}
          </nav>

          <div className="ml-auto hidden items-center gap-4 lg:flex">
            <span className="hidden font-micro text-[10px] uppercase tracking-[0.08em] text-ash sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          </div>

          <button
            type="button"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-[2px] border border-frost/25 text-bone transition-colors hover:border-emerald/60 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="app-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>

        {/* Mobile menu panel */}
        <div id="app-nav" hidden={!open} className="border-t border-frost/10 bg-void/95 backdrop-blur lg:hidden">
          <nav aria-label="Mobile" className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            <div className="flex flex-col">{links}</div>
            <div aria-hidden className="gallery-rule my-2" />
            <div className="flex items-center justify-between gap-3 px-3.5 pb-1">
              <span className="font-micro text-[10px] uppercase text-ash">
                {user?.firstName} {user?.lastName}
              </span>
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </Button>
            </div>
          </nav>
        </div>
      </header>
      <main
        className={cn(
          "flex-1",
          fluid ? "w-full" : "mx-auto w-full max-w-5xl px-6 py-8",
          className,
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
