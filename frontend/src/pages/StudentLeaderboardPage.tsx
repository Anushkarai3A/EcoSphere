import { useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { studentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { StudentLeaderboardResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Rankings</span>
          <span>{user?.school?.name ?? "Your institution"}</span>
        </MetaRow>
        <DisplayTitle lines={["LEADER", "BOARD"]} />
        <MetaRow>
          <span>Earn XP from quests, coursework and quizzes to rise.</span>
        </MetaRow>
      </section>

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-between border border-destructive/40 p-4 font-micro text-[11px] uppercase text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadLeaderboard}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-white" aria-hidden />
          <p className="font-micro text-[11px] uppercase text-ash">Calculating ranks…</p>
        </div>
      ) : (
        <>
          {/* Personal rank */}
          {myEntry && (
            <section className="flex flex-col gap-4">
              <SectionHead kicker="Your position" title={`Rank ${myEntry.rank}`} />
              <div className="flex flex-wrap gap-x-16 gap-y-6">
                <div>
                  <p className="font-display text-[80px] font-normal leading-[0.78] text-white">#{myEntry.rank}</p>
                  <p className="mt-3 font-micro text-[11px] uppercase text-ash">
                    {myEntry.name}{user?.studentProfile?.department ? ` — ${user.studentProfile.department}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-12 gap-y-4">
                  <div>
                    <p className="font-micro text-[10px] uppercase text-ash">Total XP</p>
                    <p className="mt-1 font-display text-[30px] font-normal leading-none text-white">{myEntry.totalXp.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="font-micro text-[10px] uppercase text-ash">Level</p>
                    <p className="mt-1 font-display text-[30px] font-normal leading-none text-white">{myEntry.level}</p>
                  </div>
                  <div>
                    <p className="font-micro text-[10px] uppercase text-ash">Badges</p>
                    <p className="mt-1 font-display text-[30px] font-normal leading-none text-white">{myEntry.badgeCount}</p>
                  </div>
                </div>
              </div>
              <Rule />
            </section>
          )}

          {/* Top three as monumental figures */}
          {topThree.length > 0 && (
            <section className="grid grid-cols-1 gap-px bg-frost/15 sm:grid-cols-3">
              {topThree.map((entry, i) => (
                <div key={entry.id} className="flex flex-col gap-2 bg-void p-5">
                  <p className="font-micro text-[10px] uppercase text-ash">Rank 0{i + 1}</p>
                  <p className="font-display text-[48px] font-normal leading-[0.78] text-white">0{i + 1}</p>
                  <p className="truncate text-sm text-white">{entry.name}</p>
                  <p className="font-micro text-[10px] uppercase text-ash">
                    Level {entry.level} — {entry.totalXp.toLocaleString()} XP
                  </p>
                </div>
              ))}
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
                    className="w-full rounded-[2px] border border-frost/30 bg-void py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-ash/60 focus:outline-none focus:ring-1 focus:ring-frost"
                  />
                </div>
              }
            />
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="border border-dashed border-frost/25 px-4 py-12 text-center">
              <p className="font-micro text-[11px] uppercase text-ash">No students match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-frost/25 font-micro text-[10px] uppercase text-ash">
                    <th className="w-16 px-2 py-3 text-center font-normal">Rank</th>
                    <th className="px-2 py-3 font-normal">Student</th>
                    <th className="px-2 py-3 font-normal">Department</th>
                    <th className="px-2 py-3 text-center font-normal">Level</th>
                    <th className="px-2 py-3 text-center font-normal">Badges</th>
                    <th className="px-2 py-3 text-right font-normal">Total XP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr
                      key={student.id}
                      className={cn(
                        "border-b border-frost/15 last:border-0",
                        student.isMe ? "bg-white/[0.04]" : "",
                      )}
                    >
                      <td className="px-2 py-3 text-center font-display text-[18px] text-white">
                        {student.rank}
                      </td>
                      <td className="px-2 py-3">
                        <span className="text-white">
                          {student.name}
                        </span>
                        {student.isMe && (
                          <span className="ml-2 border border-frost/50 px-1.5 py-0.5 font-micro text-[10px] uppercase text-white">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 font-micro text-[10px] uppercase text-ash">{student.department || "General"}</td>
                      <td className="px-2 py-3 text-center font-micro text-[11px] text-white">Lvl {student.level}</td>
                      <td className="px-2 py-3 text-center font-micro text-[11px] text-ash">
                        {student.badgeCount}
                      </td>
                      <td className="px-2 py-3 text-right font-micro text-[11px] text-white">
                        {student.totalXp.toLocaleString()} XP
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
