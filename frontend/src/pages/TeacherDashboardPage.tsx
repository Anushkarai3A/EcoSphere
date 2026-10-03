import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreateQuestModal } from "@/components/dashboard/CreateQuestModal";
import { DashboardQuestSection } from "@/components/dashboard/DashboardQuestSection";
import { Logo } from "@/components/Logo";
import { teacherApi, type ListUsersParams } from "@/lib/api";
import { formatDate } from "@/lib/quests";
import type { UserListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/userStatus";
import { UserDetailsDialog } from "@/components/UserDetailsDialog";

const PAGE_SIZE = 10;

type TeacherTab = "pending" | "approved";

const tabs: ReadonlyArray<{ value: TeacherTab; label: string }> = [
  { value: "pending", label: "Pending student requests" },
  { value: "approved", label: "Approved students" },
];

export function TeacherDashboardPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<TeacherTab>("pending");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: ListUsersParams = { search: search || undefined, page, pageSize: PAGE_SIZE };
    try {
      const res =
        tab === "pending" ? await teacherApi.listPendingStudents(params) : await teacherApi.listApprovedStudents(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const onReject = (item: UserListItem) => {
    const reason = window.prompt(`Rejection reason for ${item.firstName} ${item.lastName} (optional)`, "");
    if (reason === null) return;
    void run(item.id, () => teacherApi.rejectStudent(item.id, reason.trim() || undefined));
  };

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" aria-hidden />
          Teacher dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Approve student registration requests, manage your student roster, and search by student.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Create quest
        </Button>
        <Button variant="outline" onClick={() => navigate("/app/teacher/assignments")}>
          <FileText className="h-4 w-4" aria-hidden />
          Assignments
        </Button>
        <Button variant="outline" onClick={() => navigate("/app/teacher/review")}>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Review proof
        </Button>
        <Button variant="outline" onClick={() => navigate("/app/teacher/quests")}>
          <Pencil className="h-4 w-4" aria-hidden />
          Manage quests
        </Button>
        <Button variant="outline" onClick={() => navigate("/app/teacher/profile")}>
          <BadgeCheck className="h-4 w-4" aria-hidden />
          My profile
        </Button>
      </section>

      <DashboardQuestSection mode="teacher" onGoToMyQuests={() => navigate("/app/teacher/quests")} onCreateQuest={() => setCreateOpen(true)} />

      <div className="mt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Users className="h-5 w-5 text-primary" aria-hidden />
          Manage students
        </h2>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              onClick={() => {
                setTab(t.value);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, email, USN…" className="pl-8" />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-12 text-center text-sm text-muted-foreground">
          <Logo className="h-12 w-12 opacity-80" />
          {tab === "pending" ? "No students waiting for your approval." : "No approved students found."}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{tab === "pending" ? "Pending student requests" : "Approved students"}</CardTitle>
            <CardDescription>
              {total} student{total === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">USN</th>
                  <th className="px-4 py-2 font-medium">Semester</th>
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium">Registered</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {item.firstName} {item.lastName}
                      </div>
                      <StatusChip status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.studentProfile?.usn ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.studentProfile?.semester ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                        {item.studentProfile?.department ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDetail(item)}>
                          <UserRound className="h-4 w-4" aria-hidden />
                          View
                        </Button>
                        {tab === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => onReject(item)}
                              disabled={busyId === item.id}
                            >
                              {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => void run(item.id, () => teacherApi.approveStudent(item.id))}
                              disabled={busyId === item.id}
                            >
                              {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                              Approve
                            </Button>
                          </>
                        )}
                        {tab === "approved" && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" aria-hidden />
                            {item.studentProfile?.school?.name ?? "View only"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} result{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <UserDetailsDialog item={detail} onClose={() => setDetail(null)} />

      <CreateQuestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}