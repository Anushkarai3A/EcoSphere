import { LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MetaRow, Rule, SectionHead } from "@/components/gallery";
import { useAuth } from "@/lib/auth";

const statusLabel: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: "Pending admin approval",
  PENDING_TEACHER_APPROVAL: "Pending teacher approval",
  APPROVED: "Active",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export function HomePage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-10 animate-gallery-rise">
      <section className="flex flex-col gap-4 px-1 pt-10 sm:px-4">
          <p className="font-micro text-[11px] uppercase text-ash">
            {user.email}{user.school ? ` — ${user.school.name}` : ""}
          </p>
          <h1 className="text-gallery-display text-white">
            <span className="block"><span className="gallery-underline">WELCOME,</span></span>
            <span className="block"><span className="gallery-underline">{user.firstName.toUpperCase()} {user.lastName.toUpperCase()}</span></span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-micro text-[11px] uppercase text-ash">
            <span>{user.role}</span>
            <span>{statusLabel[user.status] ?? user.status}</span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
        </section>

        {user.studentProfile && (
          <section className="flex flex-col gap-4">
            <SectionHead kicker="Student dashboard" title="Streak" />
            <p className="font-display text-[80px] font-normal leading-[0.78] text-white">
              {user.studentProfile.streakCount}
              <span className="ml-4 align-middle font-micro text-[11px] uppercase text-ash">day streak</span>
            </p>
            <Rule />
          </section>
        )}

        {user.teacherProfile && (
          <section className="flex flex-col gap-4">
            <SectionHead kicker="Teacher workspace" title="Overview" />
            <MetaRow>
              <span>Quests, classes and reviews live in the teacher sections.</span>
              <span>Status — {statusLabel[user.status] ?? user.status}</span>
            </MetaRow>
            <Rule />
          </section>
        )}

        {user.role === "ADMIN" && (
          <section className="flex flex-col gap-4">
            <SectionHead
              kicker="Admin console"
              title="Oversight"
              right={
                <Link to="/app/admin">
                  <Button variant="outline" size="sm">Open admin dashboard</Button>
                </Link>
              }
            />
            <MetaRow>
              <span>Manage teacher accounts and oversee all students.</span>
            </MetaRow>
            <Rule />
          </section>
        )}

        <section className="flex flex-wrap gap-3 pb-10">
          <Link to="/app/map">
            <Button variant="outline">Open quest map</Button>
          </Link>
          {user.role === "TEACHER" && (
            <Link to="/app/teacher/quests">
              <Button variant="outline">Manage my quests</Button>
            </Link>
          )}
        </section>
      </div>
  );
}
