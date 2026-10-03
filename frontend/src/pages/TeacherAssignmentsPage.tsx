import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileEdit,
  FilePlus,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { assignmentApi } from "@/lib/api";
import type { Assignment } from "@/lib/types";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignment Management</h1>
          <p className="text-sm text-muted-foreground">
            Create, schedule, publish, and evaluate assignments for your students with automated verification and gamification.
          </p>
        </div>
        <Button onClick={() => navigate("/app/teacher/assignments/create")} className="gap-2 shadow-md">
          <Plus className="h-4 w-4" />
          Create Assignment
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Assignments</p>
              <p className="text-xl font-bold">{loading ? "..." : totalCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Published</p>
              <p className="text-xl font-bold text-emerald-500">{loading ? "..." : publishedCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-500">
              <FileEdit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Drafts</p>
              <p className="text-xl font-bold text-amber-500">{loading ? "..." : draftCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Scheduled</p>
              <p className="text-xl font-bold text-blue-500">{loading ? "..." : scheduledCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1">
          {["ALL", "PUBLISHED", "DRAFT", "SCHEDULED", "CLOSED"].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedStatus === status
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {status === "ALL" ? "All Assignments" : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAssignments}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p className="text-sm font-medium">Loading assignments...</p>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="rounded-full bg-primary/10 p-4 text-primary mb-3">
            <FilePlus className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">No assignments found</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {searchQuery
              ? `No assignments match your search "${searchQuery}".`
              : "Get started by creating your first assignment for your students."}
          </p>
          <Button onClick={() => navigate("/app/teacher/assignments/create")} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        </div>
      ) : (
        /* Assignment List Table / Cards */
        <div className="space-y-3">
          {filtered.map((a) => {
            const isPublished = a.status === "PUBLISHED";
            const isDraft = a.status === "DRAFT";
            const isScheduled = a.status === "SCHEDULED";
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
                className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isPublished
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : isDraft
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : isScheduled
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {a.status}
                    </span>

                    {a.subject && (
                      <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {a.subject}
                      </span>
                    )}

                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {a.type.replace("_", " ")}
                    </span>
                  </div>

                  <Link
                    to={`/app/teacher/assignments/${a.id}`}
                    className="text-lg font-semibold tracking-tight hover:text-primary transition-colors block"
                  >
                    {a.title}
                  </Link>

                  <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary/70" />
                      <span>Due: {dueFormatted}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary/70" />
                      <span>{a.classGroup?.name || (a.targetType === "STUDENTS" ? "Specific Students" : "All Enrolled")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-primary/70" />
                      <span>{a.maxMarks} Marks</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-emerald-500">+{Number(a.xpReward)} XP</span>
                    </div>
                  </div>
                </div>

                {/* Submissions & Actions */}
                <div className="flex items-center justify-between gap-4 border-t border-border pt-3 md:border-t-0 md:pt-0 md:justify-end">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium">Submissions</p>
                    <p className="text-base font-bold text-foreground">{submissionsCount}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/app/teacher/assignments/${a.id}`)}
                      className="gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View / Grade
                    </Button>

                    {isDraft ? (
                      <Button variant="default" size="sm" onClick={() => handlePublish(a.id)} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <Send className="h-3.5 w-3.5" />
                        Publish
                      </Button>
                    ) : isPublished ? (
                      <Button variant="ghost" size="sm" onClick={() => handleUnpublish(a.id)} className="text-muted-foreground">
                        Unpublish
                      </Button>
                    ) : null}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(a.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Archive Assignment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
