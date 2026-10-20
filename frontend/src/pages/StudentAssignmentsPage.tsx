import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  FileCheck,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import { assignmentApi } from "@/lib/api";
import type { Assignment, StudentAssignmentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead, Stat } from "@/components/gallery";

export function StudentAssignmentsPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await assignmentApi.studentList();
      setAssignments(res.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const getStatusBadge = (status?: StudentAssignmentStatus) => {
    const base = "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 font-micro text-[10px] uppercase tracking-[0.08em]";
    const dot = "inline-block h-1.5 w-1.5 rounded-full";
    switch (status) {
      case "GRADED":
        return (
          <span className={`${base} border-gold/50 bg-gold/10 text-gold`}>
            <span aria-hidden className={`${dot} bg-gold shadow-[0_0_8px_rgba(242,181,68,0.9)]`} />
            Graded
          </span>
        );
      case "SUBMITTED":
        return (
          <span className={`${base} border-emerald/50 bg-emerald/10 text-emerald`}>
            <span aria-hidden className={`${dot} bg-emerald shadow-[0_0_8px_rgba(46,207,143,0.9)]`} />
            Submitted
          </span>
        );
      case "LATE":
        return (
          <span className={`${base} border-frost/30 bg-white/[0.03] text-ash`}>
            <span aria-hidden className={`${dot} bg-ash`} />
            Submitted late
          </span>
        );
      case "RETURNED":
        return (
          <span className={`${base} border-destructive/50 bg-destructive/10 text-destructive`}>
            <span aria-hidden className={`${dot} bg-destructive`} />
            Resubmission needed
          </span>
        );
      case "OVERDUE":
        return (
          <span className={`${base} border-destructive/50 bg-destructive/10 text-destructive`}>
            <span aria-hidden className={`${dot} bg-destructive shadow-[0_0_8px_rgba(239,143,146,0.9)]`} />
            Overdue
          </span>
        );
      default:
        return (
          <span className={`${base} border-frost/30 bg-white/[0.03] text-ash`}>
            <span aria-hidden className={`${dot} bg-ash`} />
            Not started
          </span>
        );
    }
  };

  const filtered = assignments.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = a.title.toLowerCase().includes(q) || (a.subject && a.subject.toLowerCase().includes(q));
    if (!matchesSearch) return false;

    const st = a.calculatedStatus || "NOT_STARTED";
    if (selectedFilter === "PENDING") return st === "NOT_STARTED" || st === "IN_PROGRESS" || st === "RETURNED";
    if (selectedFilter === "SUBMITTED") return st === "SUBMITTED" || st === "LATE";
    if (selectedFilter === "GRADED") return st === "GRADED";
    if (selectedFilter === "OVERDUE") return st === "OVERDUE";
    return true;
  });

  const pendingCount = assignments.filter((a) => {
    const st = a.calculatedStatus || "NOT_STARTED";
    return st === "NOT_STARTED" || st === "IN_PROGRESS" || st === "RETURNED";
  }).length;
  const gradedCount = assignments.filter((a) => a.calculatedStatus === "GRADED").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Mission briefing</span>
          <span>{filtered.length} shown</span>
          <span>{assignments.length} assigned</span>
        </MetaRow>
        <DisplayTitle lines={["MY", "ASSIGNMENTS"]} />
        <MetaRow>
          <span>Coursework published by your teachers — open a brief to review and submit.</span>
        </MetaRow>
        <div className="flex flex-wrap gap-x-16 gap-y-6 pt-2">
          <Stat value={String(assignments.length)} caption="Assigned" />
          <Stat value={String(pendingCount)} caption="Pending" />
          <Stat value={String(gradedCount)} caption="Graded" accent={gradedCount > 0} />
        </div>
      </section>

      <Rule />

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-[6px] border border-frost/40 bg-deep/60 p-1.5">
          {["ALL", "PENDING", "SUBMITTED", "GRADED", "OVERDUE"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`rounded-[4px] px-3 py-1.5 font-micro text-[10px] uppercase tracking-[0.1em] transition-colors ${
                selectedFilter === filter
                  ? "bg-emerald/15 text-emerald shadow-[inset_0_0_0_1px_rgba(46,207,143,0.45)]"
                  : "text-ash hover:text-bone"
              }`}
            >
              {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" aria-hidden />
          <input
            type="text"
            placeholder="Search my assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[6px] border border-frost/40 bg-deep py-2.5 pl-9 pr-3 text-sm text-bone placeholder:text-ash/70 focus:border-cyan/70 focus:outline-none focus:ring-2 focus:ring-cyan/35"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between border border-destructive/40 bg-destructive/10 p-4 font-micro text-[11px] uppercase text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchAssignments}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-cyan" aria-hidden />
          <p className="font-micro text-[11px] uppercase text-ash">Loading your assignments…</p>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-frost/30 bg-deep/40 px-4 py-16 text-center">
          <FileCheck className="h-8 w-8 text-ash" aria-hidden />
          <p className="font-display text-[22px] font-normal text-bone">No assignments found</p>
          <p className="font-micro text-[11px] uppercase text-ash">
            {searchQuery ? `No matches for "${searchQuery}".` : "Nothing matches this filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <SectionHead kicker={`${selectedFilter} — ${filtered.length}`} title="Coursework" />
          <ul className="flex flex-col">
            {filtered.map((a, idx) => {
              const dueFormatted = new Date(a.dueAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const mySub = a.mySubmission;

              return (
                <li key={a.id} className="flex flex-col gap-3 border-t border-frost/15 py-6 last:border-b">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-ash">
                      <span className="text-emerald">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="mx-2 text-frost/40">/</span>
                      {a.subject || "Coursework"}
                    </p>
                    {getStatusBadge(a.calculatedStatus)}
                  </div>

                  <Link
                    to={`/app/student/assignments/${a.id}`}
                    className="block font-display text-[26px] font-normal leading-tight text-bone transition-colors hover:text-cyan"
                  >
                    {a.title}
                  </Link>

                  <p className="line-clamp-2 max-w-3xl text-sm text-ash">{a.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <MetaRow>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                        Due {dueFormatted}
                      </span>
                      <span>{a.maxMarks} marks</span>
                      <span className="font-title text-[15px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
                        +{Number(a.xpReward)} XP
                      </span>
                      {mySub && mySub.gradeStatus === "GRADED" && (
                        <span className="font-title text-[15px] font-semibold leading-none tracking-normal text-gold">
                          Score {mySub.score}/{a.maxMarks}
                        </span>
                      )}
                    </MetaRow>
                    <Button
                      onClick={() => navigate(`/app/student/assignments/${a.id}`)}
                      variant={a.calculatedStatus === "GRADED" ? "gold" : "default"}
                      size="sm"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      {a.calculatedStatus === "GRADED" ? "View results" : "Open"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Rule />
        </div>
      )}
    </div>
  );
}
