import { useEffect, useState } from "react";
import { RefreshCw, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { studentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { StudentLeaderboardResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Podium accents: gold, silver (frost), bronze (orange). */
const podiumTone = [
  {
    medal: "🥇",
    label: "Champion",
    card: "border-gold/55 shadow-[0_0_44px_-18px_rgba(251,191,36,0.95)]",
    figure: "text-gold text-glow-gold",
    chip: "border-gold/45 bg-gold/10 text-gold",
  },
  {
    medal: "🥈",
    label: "Silver",
    card: "border-frost/45 shadow-[0_0_44px_-20px_rgba(165,221,210,0.75)]",
    figure: "text-frost",
    chip: "border-frost/40 bg-frost/10 text-frost",
  },
  {
    medal: "🥉",
    label: "Bronze",
    card: "border-orange/55 shadow-[0_0_44px_-18px_rgba(251,146,60,0.9)]",
    figure: "text-orange",
    chip: "border-orange/45 bg-orange/10 text-orange",
  },
] as const;

function rankClass(rank: number): string {
  if (rank === 1) return "border-gold/55 bg-gold/15 text-gold";
  if (rank === 2) return "border-frost/45 bg-frost/10 text-frost";
  if (rank === 3) return "border-orange/50 bg-orange/10 text-orange";
  return "border-frost/25 bg-white/[0.05] text-ash";
}

function medalFor(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function StudentLeaderboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getLeaderboard();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load institution leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  const items = data?.items || [];
  const filtered = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.department && item.department.toLowerCase().includes(q))
    );
  });

  const myEntry = items.find((i) => i.isMe);
  const topThree = items.slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10 animate-page-in">
      <section className="flex flex-col gap-4 pt-8 animate-gallery-rise">
        <MetaRow>
          <span>Rankings</span>
          <span>{user?.school?.name ?? "Your institution"}</span>
          {data ? <span>{data.totalCount} ranked explorers</span> : null}
        </MetaRow>
        <DisplayTitle lines={["LEADER", "BOARD"]} />
        <MetaRow>
          <span>Earn XP from quests, coursework and quizzes to rise.</span>
        </MetaRow>
      </section>

      {/* Error state */}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadLeaderboard}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald" aria-hidden />
          <p className="font-micro text-[11px] uppercase text-ash">Calculating ranks…</p>
        </div>
      ) : (
        <>
          {/* Personal rank */}
          {myEntry && (
            <section className="glass-panel flex flex-col gap-5 rounded-[14px] p-6 sm:p-8">
              <SectionHead
                kicker="Your position"
                title={`Rank ${myEntry.rank}`}
                right={
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 font-micro text-[10px] uppercase tracking-[0.1em] text-cyan">
                    <Trophy className="h-3.5 w-3.5" aria-hidden />
                    Current standing
                  </span>
                }
              />
              <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
                <div>
                  <p className="font-title text-[76px] font-semibold leading-[0.78] text-gold text-glow-gold">
                    #{myEntry.rank}
                  </p>
                  <p className="mt-3 font-micro text-[11px] uppercase text-ash">
                    {myEntry.name}
                    {user?.studentProfile?.department ? ` — ${user.studentProfile.department}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-10 gap-y-4">
                  <div>
                    <p className="font-title text-[30px] font-semibold leading-none text-bone">
                      {myEntry.totalXp.toLocaleString()}
                    </p>
                    <p className="mt-2 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">Total XP</p>
                  </div>
                  <div>
                    <p className="font-title text-[30px] font-semibold leading-none text-bone">{myEntry.level}</p>
                    <p className="mt-2 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">Level</p>
                  </div>
                  <div>
                    <p className="font-title text-[30px] font-semibold leading-none text-bone">{myEntry.badgeCount}</p>
                    <p className="mt-2 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">Badges</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Top three podium */}
          {topThree.length > 0 && (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {topThree.map((entry) => {
                const tone = podiumTone[entry.rank - 1] ?? podiumTone[0];
                return (
                  <article
                    key={entry.id}
                    className={cn(
                      "glass-panel relative flex flex-col gap-3 rounded-[14px] p-5 transition-transform duration-300 hover:-translate-y-1",
                      tone.card,
                      entry.isMe && "ring-1 ring-cyan/50",
                      entry.rank === 1 && "sm:-translate-y-2 sm:hover:-translate-y-3",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[34px] leading-none" aria-hidden>
                        {tone.medal}
                      </span>
                      <span className={cn("rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase tracking-[0.12em]", tone.chip)}>
                        {tone.label}
                      </span>
                    </div>

                    <div>
                      <p className={cn("font-title text-[54px] font-semibold leading-[0.78]", tone.figure)}>
                        {entry.rank}
                      </p>
                      <p className="mt-3 truncate font-display text-[17px] font-medium text-bone">{entry.name}</p>
                      <p className="mt-1 truncate font-micro text-[10px] uppercase text-ash">
                        {entry.department || "General"}
                        {entry.isMe ? " · You" : ""}
                      </p>
                    </div>

                    <div className="mt-auto grid grid-cols-3 gap-2 border-t border-frost/10 pt-3">
                      <div>
                        <p className="font-title text-[18px] font-semibold leading-none text-bone">{entry.level}</p>
                        <p className="mt-1.5 font-micro text-[9px] uppercase tracking-[0.1em] text-ash">Level</p>
                      </div>
                      <div>
                        <p className="font-title text-[18px] font-semibold leading-none text-bone">{entry.badgeCount}</p>
                        <p className="mt-1.5 font-micro text-[9px] uppercase tracking-[0.1em] text-ash">Badges</p>
                      </div>
                      <div className="text-right">
                        <p className="font-title text-[18px] font-semibold leading-none text-gold">
                          {entry.totalXp.toLocaleString()}
                        </p>
                        <p className="mt-1.5 font-micro text-[9px] uppercase tracking-[0.1em] text-ash">XP</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {/* Search */}
          <div className="flex flex-col gap-4">
            <SectionHead
              kicker={`${items.length} ranked`}
              title="Standings"
              right={
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" aria-hidden />
                  <input
                    type="text"
                    placeholder="Search classmate, department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-[2px] border border-frost/30 bg-white/[0.05] py-2 pl-9 pr-3 font-micro text-[11px] uppercase text-bone placeholder:text-ash/60 focus:outline-none focus:ring-1 focus:ring-cyan"
                  />
                </div>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
              <p className="font-micro text-[11px] uppercase text-ash">No students match your search.</p>
            </div>
          ) : (
            <>
              {/* Desktop standings table */}
              <div className="glass-panel hidden overflow-hidden rounded-[14px] md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-frost/20 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">
                      <th className="w-24 px-5 py-4 text-center font-normal">Rank</th>
                      <th className="px-5 py-4 font-normal">Student</th>
                      <th className="px-5 py-4 text-center font-normal">Level</th>
                      <th className="px-5 py-4 text-center font-normal">Badges</th>
                      <th className="px-5 py-4 text-right font-normal">Total XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((student) => (
                      <tr
                        key={student.id}
                        className={cn(
                          "border-b border-frost/10 transition-colors last:border-0 hover:bg-white/[0.04]",
                          student.isMe && "bg-emerald/[0.08] ring-1 ring-inset ring-cyan/30",
                        )}
                      >
                        <td className="px-5 py-4 text-center">
                          <span
                            className={cn(
                              "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full border px-2 font-title text-[17px] font-semibold",
                              rankClass(student.rank),
                            )}
                          >
                            {medalFor(student.rank) ? (
                              <span aria-hidden className="text-[15px] leading-none">{medalFor(student.rank)}</span>
                            ) : null}
                            {student.rank}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-[16px] font-medium text-bone">{student.name}</span>
                            {student.isMe && (
                              <span className="rounded-[2px] border border-emerald/50 bg-emerald/10 px-1.5 py-0.5 font-micro text-[9px] uppercase tracking-[0.1em] text-emerald">
                                You
                              </span>
                            )}
                          </div>
                          <div className="mt-1 font-micro text-[10px] uppercase text-ash">
                            {student.department || "General"}
                            {student.semester ? ` · Semester ${student.semester}` : ""}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center font-title text-[17px] font-semibold text-bone">
                          {student.level}
                        </td>
                        <td className="px-5 py-4 text-center font-title text-[17px] font-semibold text-ash">
                          {student.badgeCount}
                        </td>
                        <td className="px-5 py-4 text-right font-title text-[17px] font-semibold text-gold">
                          {student.totalXp.toLocaleString()}
                          <span className="ml-1 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">XP</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile standings — stacked cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {filtered.map((student) => (
                  <li
                    key={student.id}
                    className={cn(
                      "glass-panel rounded-[12px] p-4",
                      student.isMe && "border-emerald/50 ring-1 ring-cyan/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-full border px-2 font-title text-[16px] font-semibold",
                          rankClass(student.rank),
                        )}
                      >
                        {medalFor(student.rank) ? (
                          <span aria-hidden className="text-[14px] leading-none">{medalFor(student.rank)}</span>
                        ) : null}
                        {student.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[16px] font-medium text-bone">{student.name}</p>
                        <p className="mt-0.5 truncate font-micro text-[10px] uppercase text-ash">
                          {student.department || "General"}
                        </p>
                      </div>
                      {student.isMe && (
                        <span className="shrink-0 rounded-[2px] border border-emerald/50 bg-emerald/10 px-1.5 py-0.5 font-micro text-[9px] uppercase tracking-[0.1em] text-emerald">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-frost/10 pt-3">
                      <div>
                        <p className="font-title text-[18px] font-semibold leading-none text-bone">{student.level}</p>
                        <p className="mt-1.5 font-micro text-[9px] uppercase tracking-[0.1em] text-ash">Level</p>
                      </div>
                      <div>
                        <p className="font-title text-[18px] font-semibold leading-none text-ash">{student.badgeCount}</p>
                        <p className="mt-1.5 font-micro text-[9px] uppercase tracking-[0.1em] text-ash">Badges</p>
                      </div>
                      <div className="text-right">
                        <p className="font-title text-[18px] font-semibold leading-none text-gold">
                          {student.totalXp.toLocaleString()}
                        </p>
                        <p className="mt-1.5 font-micro text-[9px] uppercase tracking-[0.1em] text-ash">XP</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Rule />
        </>
      )}
    </div>
  );
}
