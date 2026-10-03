import { CheckSquare, FileText, Film, LayoutDashboard, LogOut, Map as MapIcon, Pencil, ShieldCheck, Sparkles, Trophy, User } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `inline-flex items-center gap-1.5 border-b border-transparent px-1 py-1 font-micro text-[11px] uppercase transition-colors ${
    isActive ? "border-frost text-white" : "text-white/55 hover:border-frost/60 hover:text-white"
  }`;

interface AppShellProps {
  /** Full-bleed layout (no max-width / page padding) — used by the quest map. */
  fluid?: boolean;
  className?: string;
}

/** Route layout shell: renders the app header and an <Outlet/> for the page body. */
export function AppShell({ fluid = false, className }: AppShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-void text-bone">
      <header className="sticky top-0 z-30 border-b border-frost/15 bg-void/85 backdrop-blur">
        <div className="mx-auto flex h-10 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-2 shrink-0">
            <Logo className="h-5 w-5" />
            <span className="font-display text-sm font-normal tracking-[0.08em] text-white">ECOSPHERE</span>
          </div>
          <nav aria-label="Primary" className="flex items-center gap-4 overflow-x-auto py-1 sm:gap-5">
            {user?.role === "ADMIN" && (
              <NavLink to="/app/admin" className={navLinkClass}>
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                Dashboard
              </NavLink>
            )}
            {user?.role === "TEACHER" && (
              <>
                <NavLink to="/app/teacher" className={navLinkClass}>
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Dashboard
                </NavLink>
                <NavLink to="/app/teacher/quests" className={navLinkClass}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  My quests
                </NavLink>
                <NavLink to="/app/teacher/assignments" className={navLinkClass}>
                  <FileText className="h-4 w-4" aria-hidden />
                  Assignments
                </NavLink>
                <NavLink to="/app/teacher/quizzes" className={navLinkClass}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Quiz studio
                </NavLink>
                <NavLink to="/app/teacher/review" className={navLinkClass}>
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Review
                </NavLink>
                <NavLink to="/app/teacher/profile" className={navLinkClass}>
                  <User className="h-4 w-4" aria-hidden />
                  Profile
                </NavLink>
              </>
            )}
            {user?.role === "STUDENT" && (
              <>
                <NavLink to="/app/student-dashboard" className={navLinkClass}>
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Dashboard
                </NavLink>
                <NavLink to="/app/student" className={navLinkClass}>
                  <CheckSquare className="h-4 w-4" aria-hidden />
                  Quests
                </NavLink>
                <NavLink to="/app/map" className={navLinkClass}>
                  <MapIcon className="h-4 w-4" aria-hidden />
                  Map
                </NavLink>
                <NavLink to="/app/student/assignments" className={navLinkClass}>
                  <FileText className="h-4 w-4" aria-hidden />
                  Assignments
                </NavLink>
                <NavLink to="/app/student/quizzes" className={navLinkClass}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Quizzes
                </NavLink>
                <NavLink to="/app/student/animation-studio" className={navLinkClass}>
                  <Film className="h-4 w-4" aria-hidden />
                  Animation Studio
                </NavLink>
                <NavLink to="/app/student/leaderboard" className={navLinkClass}>
                  <Trophy className="h-4 w-4" aria-hidden />
                  Leaderboard
                </NavLink>
                <NavLink to="/app/student/profile" className={navLinkClass}>
                  <User className="h-4 w-4" aria-hidden />
                  Profile
                </NavLink>
              </>
            )}
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden font-micro text-[11px] uppercase text-white/60 sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
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
