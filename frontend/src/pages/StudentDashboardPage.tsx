import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead, Stat } from "@/components/gallery";
import { studentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { StudentDashboardData } from "@/lib/types";

export function StudentDashboardPage() {
  const { status } = useAuth();
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
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-white" aria-hidden />
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
      {/* HERO */}
      <section className="flex min-h-[52svh] flex-col justify-end gap-5 pt-16 animate-gallery-rise">
        <MetaRow>
          <span>Eco dashboard</span>
          <span>Level {metrics.level}</span>
          <span>{metrics.totalXp.toLocaleString()} XP total</span>
        </MetaRow>
        <DisplayTitle lines={["WELCOME", "BACK,", student.firstName.toUpperCase()]} />
        <MetaRow>
          <span>{upcomingDeadlines.length} upcoming</span>
          <span>{availableQuizzes.length} quizzes ready</span>
          <span>{badges.filter((b) => b.isEarned).length}/{badges.length} badges</span>
        </MetaRow>
      </section>

      <Rule />

      {/* LEVEL / XP */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Experience" title="Level" />
        <div className="flex flex-wrap gap-x-16 gap-y-6">
          <Stat value={String(metrics.level)} caption="Current level" />
          <Stat value={metrics.totalXp.toLocaleString()} caption="Total XP" />
          <Stat value={`${metrics.levelProgress}/${metrics.levelTarget}`} caption="Progress to next level" />
        </div>
        <div className="h-px w-full bg-frost/25" aria-hidden>
          <div
            className="h-px bg-white transition-all"
            style={{ width: `${Math.min(100, (metrics.levelProgress / metrics.levelTarget) * 100)}%` }}
          />
        </div>
      </section>

      <Rule />

      {/* UPCOMING */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Deadlines" title="Upcoming" />
        {upcomingDeadlines.length === 0 ? (
          <p className="font-micro text-[11px] uppercase text-ash">No upcoming deadlines.</p>
        ) : (
          <ul className="flex flex-col">
            {upcomingDeadlines.map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-4 border-t border-frost/15 py-4 last:border-b">
                <div>
                  <p className="font-display text-[22px] font-normal leading-none text-white">{d.title}</p>
                  <p className="mt-2 font-micro text-[10px] uppercase text-ash">Due {new Date(d.dueAt).toLocaleDateString()}</p>
                </div>
                <span className="shrink-0 font-micro text-[11px] text-white">+{d.xpReward} XP</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Rule />

      {/* QUIZZES */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Assessment" title="Quizzes" />
        {availableQuizzes.length === 0 ? (
          <p className="font-micro text-[11px] uppercase text-ash">No new quizzes available.</p>
        ) : (
          <ul className="flex flex-col">
            {availableQuizzes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-4 border-t border-frost/15 py-4 last:border-b">
                <div>
                  <p className="font-display text-[22px] font-normal leading-none text-white">{q.title}</p>
                  <p className="mt-2 font-micro text-[10px] uppercase text-ash">{q.difficulty} — {q.questionCount} questions</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => (window.location.href = `/app/student/quizzes/${q.id}`)}>
                  Take quiz
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Rule />

      {/* BADGES */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Milestones" title="Badges" />
        <div className="grid grid-cols-2 gap-px bg-frost/15 sm:grid-cols-3 md:grid-cols-4">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`flex flex-col gap-2 bg-void p-5 ${badge.isEarned ? "" : "opacity-40"}`}
            >
              <p className="font-micro text-[10px] uppercase text-ash">{badge.isEarned ? "Earned" : "Locked"}</p>
              <p className="font-display text-[20px] font-normal leading-none text-white">{badge.name}</p>
              <p className="line-clamp-2 text-xs text-ash">{badge.description}</p>
              {badge.isEarned && badge.earnedAt && (
                <p className="font-micro text-[10px] uppercase text-white/70">{new Date(badge.earnedAt).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <Rule />

      {/* ACTIVITY */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Feed" title="Recent activity" />
        {recentActivity.length === 0 ? (
          <p className="font-micro text-[11px] uppercase text-ash">No recent activity.</p>
        ) : (
          <ul className="flex flex-col">
            {recentActivity.map((act) => (
              <li key={act.id} className="flex items-baseline justify-between gap-4 border-t border-frost/15 py-4 last:border-b">
                <div>
                  <p className="text-sm text-white">{act.title}</p>
                  <p className="mt-1 font-micro text-[10px] uppercase text-ash">
                    {act.description} — {new Date(act.timestamp).toLocaleString()}
                  </p>
                </div>
                {act.xp > 0 && (
                  <span className="shrink-0 font-micro text-[11px] text-white">+{act.xp} XP</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
