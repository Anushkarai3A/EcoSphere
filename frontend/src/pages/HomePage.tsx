import { ArrowUpRight, Flame, LogOut, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { WorldBackground } from "@/components/ecosphere/WorldBackground";
import { useAuth } from "@/lib/auth";

const statusLabel: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: "Pending admin approval",
  PENDING_TEACHER_APPROVAL: "Pending teacher approval",
  APPROVED: "Active",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-micro text-[10px] uppercase tracking-[0.08em]";

const statusTone: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: "border-cyan/40 bg-cyan/10 text-cyan",
  PENDING_TEACHER_APPROVAL: "border-cyan/40 bg-cyan/10 text-cyan",
  APPROVED: "border-emerald/40 bg-emerald/10 text-emerald",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  SUSPENDED: "border-gold/40 bg-gold/10 text-gold",
};

export function HomePage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <>
    <WorldBackground />
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 pb-16 pt-6 animate-page-in sm:px-8">
      {/* HERO */}
      <section className="relative isolate overflow-hidden rounded-[20px] border border-frost/15">
        <img
          src="/assets/world-map.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full scale-105 object-cover object-[64%_40%] opacity-30"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(3,18,26,0.96)_0%,rgba(3,18,26,0.86)_44%,rgba(6,24,34,0.58)_100%)]"
        />
        <div className="flex flex-col gap-5 px-6 py-12 sm:px-10 sm:py-16">
          <MetaRow>
            <span>{user.email}</span>
            {user.school ? <span>{user.school.name}</span> : null}
          </MetaRow>
          <DisplayTitle
            lines={["WELCOME,", `${user.firstName.toUpperCase()} ${user.lastName.toUpperCase()}`]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${chipBase} border-cyan/40 bg-cyan/10 text-cyan`}>{user.role}</span>
            <span
              className={`${chipBase} ${statusTone[user.status] ?? "border-frost/30 bg-white/[0.06] text-ash"}`}
            >
              {statusLabel[user.status] ?? user.status}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </section>

      {user.studentProfile && (
        <section className="flex flex-col gap-5">
          <SectionHead
            kicker="Student dashboard"
            title="Streak"
            right={<Flame className="h-5 w-5 text-gold" aria-hidden />}
          />
          <div className="glass-panel flex flex-wrap items-end gap-x-8 gap-y-3 rounded-[10px] px-6 py-6">
            <p className="font-title text-[76px] font-semibold leading-[0.78] text-bone">
              {user.studentProfile.streakCount}
            </p>
            <p className="pb-3 font-micro text-[11px] uppercase tracking-[0.08em] text-ash">
              day streak
            </p>
          </div>
          <Rule />
        </section>
      )}

      {user.teacherProfile && (
        <section className="flex flex-col gap-5">
          <SectionHead
            kicker="Teacher workspace"
            title="Overview"
            right={<Pencil className="h-5 w-5 text-emerald" aria-hidden />}
          />
          <div className="glass-panel rounded-[10px] px-6 py-5">
            <MetaRow>
              <span>Quests, classes and reviews live in the teacher sections.</span>
              <span className="text-bone">
                Status — {statusLabel[user.status] ?? user.status}
              </span>
            </MetaRow>
          </div>
          <Rule />
        </section>
      )}

      {user.role === "ADMIN" && (
        <section className="flex flex-col gap-5">
          <SectionHead
            kicker="Admin console"
            title="Oversight"
            right={
              <Link to="/app/admin">
                <Button variant="outline" size="sm">
                  Open admin dashboard
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </Link>
            }
          />
          <div className="glass-panel rounded-[10px] px-6 py-5">
            <MetaRow>
              <span>Manage teacher accounts and oversee all students.</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald" aria-hidden />
            </MetaRow>
          </div>
          <Rule />
        </section>
      )}

      <section className="flex flex-wrap gap-3 pb-4">
        <Link to="/app/map">
          <Button variant="outline">
            <MapPin className="h-4 w-4" aria-hidden />
            Open quest map
          </Button>
        </Link>
        {user.role === "TEACHER" && (
          <Link to="/app/teacher/quests">
            <Button variant="outline">
              <Pencil className="h-4 w-4" aria-hidden />
              Manage my quests
            </Button>
          </Link>
        )}
      </section>
    </div>
    </>
  );
}
