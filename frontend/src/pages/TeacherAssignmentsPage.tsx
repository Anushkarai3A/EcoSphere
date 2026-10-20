import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CalendarClock,
  ClipboardList,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { assignmentApi } from "@/lib/api";
import type { Assignment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const statusTone: Record<string, string> = {
  PUBLISHED: "border-emerald/40 bg-emerald/10 text-emerald",
  DRAFT: "border-frost/30 bg-white/[0.06] text-ash",
  SCHEDULED: "border-cyan/40 bg-cyan/10 text-cyan",
  CLOSED: "border-gold/40 bg-gold/10 text-gold",
};

const tileTone = {
  emerald: { box: "border-emerald/35 bg-emerald/10", text: "text-emerald" },
  cyan: { box: "border-cyan/35 bg-cyan/10", text: "text-cyan" },
  gold: { box: "border-gold/35 bg-gold/10", text: "text-gold" },
  ash: { box: "border-frost/30 bg-white/[0.06]", text: "text-ash" },
} as const;

function MetricTile({
  icon: Icon,
  value,
  label,
  tone = "emerald",
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: keyof typeof tileTone;
}) {
  const t = tileTone[tone];
  return (
    <div className="glass-panel flex items-start justify-between gap-3 rounded-[10px] p-4">
      <div className="min-w-0">
        <p className="font-title text-[34px] font-semibold leading-none text-bone">{value}</p>
        <p className="mt-2 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">{label}</p>
      </div>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border", t.box)}>
        <Icon className={cn("h-4 w-4", t.text)} aria-hidden />
      </span>
    </div>
  );
}

export function TeacherAssignmentsPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await assignmentApi.list(selectedStatus === "ALL" ? undefined : selectedStatus);
      setAssignments(res.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [selectedStatus]);

  const handlePublish = async (id: string) => {
    try {
      await assignmentApi.publish(id);
      fetchAssignments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to publish assignment");
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await assignmentApi.unpublish(id);
      fetchAssignments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to unpublish assignment");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this assignment?")) return;
    try {
      await assignmentApi.remove(id);
      fetchAssignments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to archive assignment");
    }
  };

  const filtered = assignments.filter((a) => {
    const q = searchQuery.toLowerCase();
    return a.title.toLowerCase().includes(q) || (a.subject && a.subject.toLowerCase().includes(q));
  });

  const totalCount = assignments.length;
  const publishedCount = assignments.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = assignments.filter((a) => a.status === "DRAFT").length;
  const scheduledCount = assignments.filter((a) => a.status === "SCHEDULED").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
      {/* HERO */}
      <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Assignment workspace</span>
          <span>{totalCount} assignments</span>
        </MetaRow>
        <DisplayTitle lines={["ASSIGNMENT", "MANAGEMENT"]} />
        <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
          Create, schedule, publish, and evaluate assignments for your students with automated verification and gamification.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/app/teacher/assignments/create")}>
            <Plus className="h-4 w-4" aria-hidden />
            Create Assignment
          </Button>
        </div>
      </section>

      <Rule />

      {/* METRICS */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Overview" title="Metrics" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile icon={ClipboardList} value={loading ? "…" : String(totalCount)} label="Total assignments" />
          <MetricTile icon={Send} value={loading ? "…" : String(publishedCount)} label="Published" tone="cyan" />
          <MetricTile icon={Pencil} value={loading ? "…" : String(draftCount)} label="Drafts" tone="ash" />
          <MetricTile icon={CalendarClock} value={loading ? "…" : String(scheduledCount)} label="Scheduled" tone="gold" />
        </div>
      </section>

      <Rule />

      {/* LIST */}
      <section className="flex flex-col gap-5">
        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-frost/20 bg-deep/60 p-1">
            {["ALL", "PUBLISHED", "DRAFT", "SCHEDULED", "CLOSED"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-micro text-[10px] uppercase tracking-[0.06em] transition-colors",
                  selectedStatus === status
                    ? "bg-emerald/15 text-emerald shadow-[inset_0_0_0_1px_rgba(46,207,143,0.45)]"
                    : "text-ash hover:text-bone",
                )}
              >
                {status === "ALL" ? "All Assignments" : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" aria-hidden />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 pl-9 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 focus:border-cyan/70 focus:outline-none focus:ring-2 focus:ring-cyan/35"
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-destructive/40 bg-destructive/10 p-4 font-micro text-[11px] uppercase text-destructive">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchAssignments}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald" aria-hidden />
            <p className="font-micro text-[11px] uppercase text-ash">Loading assignments...</p>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-frost/25 px-4 py-16 text-center">
            <Logo className="mb-3 h-12 w-12 opacity-80" />
            <h3 className="font-display text-[22px] font-medium text-bone">No assignments found</h3>
            <p className="mt-1 mb-4 max-w-md font-micro text-[11px] uppercase text-ash">
              {searchQuery
                ? `No assignments match your search "${searchQuery}".`
                : "Get started by creating your first assignment for your students."}
            </p>
            <Button onClick={() => navigate("/app/teacher/assignments/create")}>
              <Plus className="h-4 w-4" aria-hidden />
              Create Assignment
            </Button>
          </div>
        ) : (
          /* Assignment List */
          <div className="flex flex-col">
            {filtered.map((a) => {
              const isPublished = a.status === "PUBLISHED";
              const isDraft = a.status === "DRAFT";
              const submissionsCount = a._count?.submissions ?? a.submissions?.length ?? 0;
              const dueFormatted = new Date(a.dueAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={a.id}
                  className="group flex flex-col gap-4 border-t border-frost/15 py-5 last:border-b md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`${chipBase} ${statusTone[a.status] ?? "border-frost/30 bg-white/[0.06] text-ash"}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                        {a.status}
                      </span>

                      {a.subject && (
                        <span className="rounded-[2px] border border-frost/30 bg-white/[0.06] px-2 py-0.5 font-micro text-[10px] uppercase text-white">
                          {a.subject}
                        </span>
                      )}

                      <span className="rounded-[2px] border border-frost/30 bg-white/[0.06] px-2 py-0.5 font-micro text-[10px] uppercase text-white">
                        {a.type.replace("_", " ")}
                      </span>
                    </div>

                    <Link
                      to={`/app/teacher/assignments/${a.id}`}
                      className="block font-display text-[22px] font-normal leading-none text-white hover:opacity-80 transition-opacity"
                    >
                      {a.title}
                    </Link>

                    <p className="line-clamp-2 max-w-3xl text-sm text-ash">{a.description}</p>

                    <MetaRow>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                        Due: {dueFormatted}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        {a.classGroup?.name || (a.targetType === "STUDENTS" ? "Specific Students" : "All Enrolled")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden />
                        {a.maxMarks} Marks
                      </span>
                      <span className="text-white">+{Number(a.xpReward)} XP</span>
                    </MetaRow>
                  </div>

                  {/* Submissions & Actions */}
                  <div className="flex items-center justify-between gap-4 border-t border-frost/15 pt-3 md:justify-end md:border-t-0 md:pt-0">
                    <div className="text-right">
                      <p className="font-micro text-[10px] uppercase text-ash">Submissions</p>
                      <p className="font-display text-[22px] font-normal leading-none text-white">{submissionsCount}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/app/teacher/assignments/${a.id}`)}
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        View / Grade
                      </Button>

                      {isDraft ? (
                        <Button variant="default" size="sm" onClick={() => handlePublish(a.id)} className="bg-charcoal hover:bg-white/[0.06]">
                          <Send className="h-3.5 w-3.5" aria-hidden />
                          Publish
                        </Button>
                      ) : isPublished ? (
                        <Button variant="ghost" size="sm" onClick={() => handleUnpublish(a.id)} className="text-ash">
                          Unpublish
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(a.id)}
                        className="h-8 w-8 text-ash hover:text-white"
                        title="Archive Assignment"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
