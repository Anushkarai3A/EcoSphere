import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Flame,
  Loader2,
  Medal,
  Sparkles,
  Swords,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { AchievementCard } from "@/components/ecosphere/AchievementCard";
import { LevelBadge } from "@/components/ecosphere/LevelBadge";
import { XPBar } from "@/components/ecosphere/XPBar";
import { DashboardQuestSection } from "@/components/dashboard/DashboardQuestSection";
import { StatCard } from "@/components/dashboard/StatCard";
import { studentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { RecentActivityItem, StudentDashboardData } from "@/lib/types";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-micro text-[10px] uppercase tracking-[0.08em]";

const statusLabel: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: "Pending admin approval",
  PENDING_TEACHER_APPROVAL: "Pending teacher approval",
  APPROVED: "Active",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const statusTone: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: "border-cyan/40 bg-cyan/10 text-cyan",
  PENDING_TEACHER_APPROVAL: "border-cyan/40 bg-cyan/10 text-cyan",
  APPROVED: "border-emerald/40 bg-emerald/10 text-emerald",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  SUSPENDED: "border-gold/40 bg-gold/10 text-gold",
};

/** Activity-type accent for the recent-activity timeline rail. */
const activityTone: Record<RecentActivityItem["type"], string> = {
  QUEST_COMPLETED: "border-emerald bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.8)]",
  ASSIGNMENT_SUBMITTED: "border-cyan bg-cyan shadow-[0_0_10px_rgba(34,211,238,0.8)]",
  ASSIGNMENT_GRADED: "border-blue bg-blue shadow-[0_0_10px_rgba(56,189,248,0.8)]",
  QUIZ_PASSED: "border-purple bg-purple shadow-[0_0_10px_rgba(167,139,250,0.8)]",
  BADGE_EARNED: "border-gold bg-gold shadow-[0_0_10px_rgba(251,191,36,0.85)]",
  XP_EARNED: "border-turquoise bg-turquoise shadow-[0_0_10px_rgba(45,212,191,0.8)]",
};

export function StudentDashboardPage() {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getDashboard();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Wait for the session bootstrap (refresh-cookie → memory token) before
  // fetching; otherwise the request goes out with no Bearer token → 401.
  useEffect(() => {
    if (status === "authenticated") void loadDashboard();
    else if (status === "anonymous") setLoading(false);
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-emerald" aria-hidden />
        <p className="font-micro text-[11px] uppercase text-ash">Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="font-micro text-[11px] uppercase text-destructive">{error}</p>
        <Button variant="outline" onClick={loadDashboard}>
          Retry
        </Button>
      </div>
    );
  }

  const { student, metrics, badges, upcomingDeadlines, availableQuizzes, recentActivity } = data!;
  const earnedBadges = badges.filter((b) => b.isEarned).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 pb-16 sm:px-10 animate-page-in">
      {/* HERO — command center greeting */}
      <section className="flex flex-col gap-6 pt-8 animate-gallery-rise">
        <MetaRow>
          <span>Student command center</span>
          <span>{student.schoolName || "Ecosphere Institution"}</span>
          <span>Rank #{metrics.leaderboardRank} / {metrics.totalStudentsInSchool}</span>
        </MetaRow>

        <DisplayTitle lines={["WELCOME BACK,", "EXPLORER"]} />

        <div className="flex flex-col gap-2">
          <p className="font-display text-[18px] leading-relaxed text-bone">
            Ready for your next mission, {student.firstName}.
          </p>
          <p className="max-w-2xl font-micro text-[11px] uppercase leading-[1.7] tracking-[0.06em] text-ash">
            {student.department || "Student"}
            {student.semester ? ` · Semester ${student.semester}` : ""}
            {student.grade ? ` · ${student.grade}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`${chipBase} border-cyan/40 bg-cyan/10 text-cyan`}>
            {user?.role ?? "STUDENT"}
          </span>
          <span className={`${chipBase} ${statusTone[user?.status ?? ""] ?? "border-frost/30 bg-white/[0.06] text-ash"}`}>
            {statusLabel[user?.status ?? ""] ?? user?.status ?? "Active"}
          </span>
          <span className={`${chipBase} border-emerald/40 bg-emerald/10 text-emerald`}>
            <BadgeCheck className="h-3 w-3" aria-hidden />
            {student.firstName} the Explorer
          </span>
        </div>
      </section>

      {/* LEVEL / XP */}
      <section className="glass-panel flex flex-col gap-7 rounded-[14px] p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8 animate-gallery-rise">
        <LevelBadge level={metrics.level} className="mx-auto sm:mx-0" />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-emerald">
                Experience
              </p>
              <h2 className="mt-1.5 font-display text-[26px] font-medium leading-tight tracking-tight text-bone">
                Progress to level {metrics.level + 1}
              </h2>
            </div>
            <div className="text-right">
              <p className="font-title text-[30px] font-semibold leading-none text-gold text-glow-gold">
                {metrics.totalXp.toLocaleString()}
              </p>
              <p className="mt-1.5 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">
                Total XP
              </p>
            </div>
          </div>

          <XPBar
            level={metrics.level}
            progress={metrics.levelProgress}
            target={metrics.levelTarget}
            totalXp={metrics.totalXp}
          />

          <MetaRow>
            <span>Rank #{metrics.leaderboardRank} of {metrics.totalStudentsInSchool}</span>
            <span>{metrics.badgeCount} badges</span>
            <span>{metrics.activeQuestsCount} active quests</span>
          </MetaRow>
        </div>
      </section>

      {/* STAT ROW */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Quests completed"
          value={metrics.completedQuestsCount}
          tone="emerald"
        />
        <StatCard
          icon={Sparkles}
          label="XP earned"
          value={metrics.totalXp.toLocaleString()}
          sub={`${metrics.submittedQuestsCount} awaiting review`}
          tone="sky"
        />
        <StatCard
          icon={Medal}
          label="Badges"
          value={`${earnedBadges}/${badges.length}`}
          tone="amber"
        />
        <StatCard
          icon={Flame}
          label="Current streak"
          value={student.streakCount}
          sub="day activity streak"
          tone="primary"
        />
      </section>

      <Rule />

      {/* CONTINUE YOUR ADVENTURE */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Continue your adventure"
          title="Your active quests"
          right={
            <span className="font-micro text-[10px] uppercase tracking-[0.1em] text-ash">
              {metrics.activeQuestsCount} in progress
            </span>
          }
        />
        <DashboardQuestSection mode="student" onGoToMyQuests={() => navigate("/app/student")} />
      </section>

      <Rule />

      {/* ACHIEVEMENTS */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Milestones"
          title="Your achievements"
          right={
            <span className="font-micro text-[10px] uppercase tracking-[0.1em] text-gold">
              {earnedBadges} / {badges.length} unlocked
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {badges.map((badge) => (
            <AchievementCard key={badge.id} badge={badge} />
          ))}
        </div>
      </section>

      <Rule />

      {/* RECENT ACTIVITY */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Feed" title="Recent activity" />
        {recentActivity.length === 0 ? (
          <p className="font-micro text-[11px] uppercase text-ash">No recent activity.</p>
        ) : (
          <ol className="flex flex-col">
            {recentActivity.map((act, i) => (
              <li key={act.id} className="flex gap-4">
                <div aria-hidden className="flex flex-col items-center">
                  <span
                    className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full border ${activityTone[act.type] ?? "border-frost bg-frost"}`}
                  />
                  {i < recentActivity.length - 1 && (
                    <span className="my-1 w-px flex-1 bg-frost/20" />
                  )}
                </div>
                <div
                  className={`flex min-w-0 flex-1 items-start justify-between gap-4 ${
                    i < recentActivity.length - 1 ? "border-b border-frost/10 pb-6" : "pt-0"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-display text-[16px] font-medium leading-snug text-bone">
                      {act.title}
                    </p>
                    <p className="mt-1.5 font-micro text-[10px] uppercase leading-[1.6] text-ash">
                      {act.description} — {new Date(act.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {act.xp > 0 && (
                    <span className="shrink-0 rounded-[2px] border border-gold/40 bg-gold/10 px-2 py-1 font-micro text-[10px] uppercase text-gold">
                      +{act.xp} XP
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Rule />

      {/* UPCOMING */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Deadlines"
          title="Upcoming"
          right={
            <span className="font-micro text-[10px] uppercase tracking-[0.1em] text-ash">
              {upcomingDeadlines.length} queued
            </span>
          }
        />
        {upcomingDeadlines.length === 0 ? (
          <p className="font-micro text-[11px] uppercase text-ash">No upcoming deadlines.</p>
        ) : (
          <ul className="flex flex-col">
            {upcomingDeadlines.map((d) => (
              <li
                key={d.id}
                className="flex items-baseline justify-between gap-4 border-t border-frost/15 py-4 last:border-b"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-display text-[19px] font-normal leading-snug text-bone">
                    <CalendarDays className="h-4 w-4 shrink-0 text-ash" aria-hidden />
                    <span className="min-w-0 truncate">{d.title}</span>
                  </p>
                  <p className="mt-2 font-micro text-[10px] uppercase text-ash">
                    Due {new Date(d.dueAt).toLocaleDateString()}
                    {d.subject ? ` · ${d.subject}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-[2px] border border-gold/40 bg-gold/10 px-2 py-1 font-micro text-[10px] uppercase text-gold">
                  +{d.xpReward} XP
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Rule />

      {/* QUIZZES */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Assessment"
          title="Quizzes"
          right={
            <span className="font-micro text-[10px] uppercase tracking-[0.1em] text-ash">
              {availableQuizzes.length} ready
            </span>
          }
        />
        {availableQuizzes.length === 0 ? (
          <p className="font-micro text-[11px] uppercase text-ash">No new quizzes available.</p>
        ) : (
          <ul className="flex flex-col">
            {availableQuizzes.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-4 border-t border-frost/15 py-4 last:border-b"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-display text-[19px] font-normal leading-snug text-bone">
                    <Swords className="h-4 w-4 shrink-0 text-purple" aria-hidden />
                    <span className="min-w-0 truncate">{q.title}</span>
                  </p>
                  <p className="mt-2 font-micro text-[10px] uppercase text-ash">
                    {q.difficulty} — {q.questionCount} questions
                    {q.teacherName ? ` · ${q.teacherName}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = `/app/student/quizzes/${q.id}`)}
                >
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Take quiz
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
