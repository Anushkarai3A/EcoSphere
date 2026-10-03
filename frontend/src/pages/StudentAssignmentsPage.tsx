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
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";

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
    const base = "inline-flex items-center gap-1 rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase";
    switch (status) {
      case "GRADED":
        return <span className={`${base} border-frost/50 text-white`}>Graded</span>;
      case "SUBMITTED":
        return <span className={`${base} border-frost/40 text-white`}>Submitted</span>;
      case "LATE":
        return <span className={`${base} border-frost/30 text-ash`}>Submitted late</span>;
      case "RETURNED":
        return <span className={`${base} border-destructive/50 text-destructive`}>Resubmission needed</span>;
      case "OVERDUE":
        return <span className={`${base} border-destructive/50 text-destructive`}>Overdue</span>;
      default:
        return <span className={`${base} border-frost/20 text-ash`}>Not started</span>;
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Coursework</span>
          <span>{filtered.length} shown</span>
        </MetaRow>
        <DisplayTitle lines={["MY", "ASSIGNMENTS"]} />
      </section>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 border border-frost/25 p-1">
          {["ALL", "PENDING", "SUBMITTED", "GRADED", "OVERDUE"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 font-micro text-[10px] uppercase transition-colors ${
                selectedFilter === filter
                  ? "bg-charcoal text-white"
                  : "text-white/55 hover:text-white"
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
            className="w-full rounded-[2px] border border-frost/30 bg-void py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-ash/60 focus:outline-none focus:ring-1 focus:ring-frost"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between border border-destructive/40 p-4 font-micro text-[11px] uppercase text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchAssignments}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-white" aria-hidden />
          <p className="font-micro text-[11px] uppercase text-ash">Loading your assignments…</p>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-frost/25 px-4 py-16 text-center">
          <FileCheck className="h-8 w-8 text-ash" aria-hidden />
          <p className="font-display text-[22px] font-normal text-white">No assignments found</p>
          <p className="font-micro text-[11px] uppercase text-ash">
            {searchQuery ? `No matches for "${searchQuery}".` : "Nothing matches this filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <SectionHead kicker={`${selectedFilter} — ${filtered.length}`} title="Coursework" />
          <ul className="flex flex-col">
            {filtered.map((a) => {
              const dueFormatted = new Date(a.dueAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const mySub = a.mySubmission;

              return (
                <li key={a.id} className="flex flex-col gap-3 border-t border-frost/15 py-5 last:border-b">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-micro text-[10px] uppercase text-ash">{a.subject || "Coursework"}</p>
                    {getStatusBadge(a.calculatedStatus)}
                  </div>

                  <Link
                    to={`/app/student/assignments/${a.id}`}
                    className="block font-display text-[26px] font-normal leading-none text-white hover:opacity-80"
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
                      <span className="text-white">+{Number(a.xpReward)} XP</span>
                      {mySub && mySub.gradeStatus === "GRADED" && (
                        <span className="text-white">Score {mySub.score}/{a.maxMarks}</span>
                      )}
                    </MetaRow>
                    <Button
                      onClick={() => navigate(`/app/student/assignments/${a.id}`)}
                      variant={a.calculatedStatus === "GRADED" ? "outline" : "default"}
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
