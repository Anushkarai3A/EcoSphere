import { useEffect, useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  /** Hash targets scroll on the landing page; route targets navigate. */
  hash?: boolean;
}

/** Role-aware destinations so every nav link lands somewhere real. */
function useNavItems(): { primary: NavItem[]; onApp: NavItem[] } {
  const { user } = useAuth();
  const role = user?.role;
  const profileHref = role === "STUDENT" ? "/app/student/profile" : role === "TEACHER" ? "/app/teacher/profile" : role === "ADMIN" ? "/app/admin" : "/login";
  return {
    primary: [
      { label: "Home", to: "/" },
      { label: "Explore", to: "#explore", hash: true },
      { label: "Quests", to: role === "STUDENT" ? "/app/student" : role === "TEACHER" ? "/app/teacher/quests" : role === "ADMIN" ? "/app/admin" : "/login" },
      { label: "Assignments", to: role === "STUDENT" ? "/app/student/assignments" : role === "TEACHER" ? "/app/teacher/assignments" : "/login" },
      ...(role === "STUDENT" ? [{ label: "Leaderboard", to: "/app/student/leaderboard" }] : []),
      { label: user ? "Profile" : "Login", to: profileHref },
    ],
    onApp: user
      ? [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Profile", to: role === "STUDENT" ? "/app/student/profile" : role === "TEACHER" ? "/app/teacher/profile" : "/app/admin" },
        ]
      : [],
  };
}

const linkBase =
  "group relative whitespace-nowrap font-micro text-[12px] uppercase tracking-[0.08em] transition-colors duration-200 py-2 px-4";

/**
 * Premium game-style navigation: transparent over the hero, dark glass after
 * scroll, emerald active indicator, responsive hamburger panel.
 */
export function GameNavbar() {
  const { user, logout } = useAuth();
  const { primary, onApp } = useNavItems();
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname, hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (item: NavItem): boolean =>
    item.hash ? hash === item.to : item.to === "/" ? pathname === "/" : pathname === item.to;

  const renderLink = (item: NavItem, mobile = false) =>
    item.hash ? (
      <a
        key={item.label}
        href={item.to}
        onClick={() => setOpen(false)}
        className={cn(
          linkBase,
          isActive(item) ? "text-bone" : "text-ash hover:text-bone",
          mobile && "block w-full rounded-[2px] px-4 py-3 hover:bg-white/5",
        )}
      >
        {item.label}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-2 -bottom-0.5 h-px origin-left scale-x-0 bg-gradient-to-r from-emerald to-cyan transition-transform duration-300 group-hover:scale-x-100",
            isActive(item) && "scale-x-100",
          )}
        />
      </a>
    ) : (
      <Link
        key={item.label}
        to={item.to}
        onClick={() => setOpen(false)}
        className={cn(
          linkBase,
          isActive(item) ? "text-bone" : "text-ash hover:text-bone",
          mobile && "block w-full rounded-[2px] px-4 py-3 hover:bg-white/5",
        )}
      >
        {item.label}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-2 -bottom-0.5 h-px origin-left scale-x-0 bg-gradient-to-r from-emerald to-cyan transition-transform duration-300 group-hover:scale-x-100",
            isActive(item) && "scale-x-100",
          )}
        />
      </Link>
    );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass-strong" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        {/* Brand */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="EcoSphere home">
          <Logo className="h-7 w-7" />
          <span className="font-title text-[15px] font-semibold uppercase tracking-[0.22em] text-bone">
            EcoSphere
          </span>
        </Link>

        {/* Desktop links */}
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {primary.map((item) => renderLink(item))}
        </nav>

        {/* Right side */}
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <Link to="/dashboard" className="flex items-center gap-2 font-micro text-[11px] uppercase text-ash transition-colors hover:text-bone">
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                Dashboard
              </Link>
              {onApp.map((item) => (
                <Link key={item.label} to={item.to} className="font-micro text-[11px] uppercase text-ash transition-colors hover:text-bone">
                  {item.label}
                </Link>
              ))}
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="flex items-center gap-2 font-micro text-[11px] uppercase text-ash transition-colors hover:text-bone">
                <UserIcon className="h-3.5 w-3.5" aria-hidden />
                Login
              </Link>
              <Link to="/register">
                <Button size="sm">Start free</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-frost/25 text-bone transition-colors hover:border-emerald/60 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {/* Mobile panel */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="glass-strong border-t border-frost/10 lg:hidden"
      >
        <nav aria-label="Mobile" className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
          {primary.map((item) => renderLink(item, true))}
          <div aria-hidden className="my-2 gallery-rule" />
          {user ? (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-[2px] px-4 py-3 font-micro text-[12px] uppercase text-ash hover:bg-white/5 hover:text-bone">
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
                className="rounded-[2px] px-4 py-3 text-left font-micro text-[12px] uppercase text-ash hover:bg-white/5 hover:text-bone"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="flex gap-3 px-4 py-2">
              <Link to="/login" onClick={() => setOpen(false)} className="flex-1">
                <Button variant="outline" className="w-full">
                  Login
                </Button>
              </Link>
              <Link to="/register" onClick={() => setOpen(false)} className="flex-1">
                <Button className="w-full">Start free</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
