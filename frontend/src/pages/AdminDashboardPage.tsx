import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
  Ban,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { adminApi, type ListUsersParams } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/quests";
import type { UserListItem, UserStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { statusMeta, StatusChip } from "@/components/userStatus";
import { UserDetailsDialog } from "@/components/UserDetailsDialog";

const PAGE_SIZE = 10;

type AdminTab = "pending" | "manage" | "students";

const tabs: ReadonlyArray<{ value: AdminTab; label: string }> = [
  { value: "pending", label: "Pending teacher requests" },
  { value: "manage", label: "Teacher management" },
  { value: "students", label: "Student overview" },
];

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>("pending");
  const [statusFilter, setStatusFilter] = useState<UserStatus>("APPROVED");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserListItem | null>(null);

  const loadParams = useCallback((): ListUsersParams => {
    if (tab === "students") return { search: search || undefined, page, pageSize: PAGE_SIZE };
    return {
      status: (tab === "pending" ? "PENDING_ADMIN_APPROVAL" : statusFilter) as ListUsersParams["status"],
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    };
  }, [tab, statusFilter, search, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = loadParams();
      const res = tab === "students" ? await adminApi.listStudents(params) : await adminApi.listTeachers(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, loadParams]);

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

  const onApproveTeacher = (id: string) => run(id, () => adminApi.verifyTeacher(id));
  const onRejectTeacher = (item: UserListItem) => {
    const reason = window.prompt(`Rejection reason for ${item.firstName} ${item.lastName} (optional)`, "");
    if (reason === null) return;
    void run(item.id, () => adminApi.rejectTeacherVerification(item.id, reason.trim() || undefined));
  };
  const onSuspend = (item: UserListItem) => {
    if (window.confirm(`Suspend ${item.firstName} ${item.lastName}? They will no longer be able to sign in.`)) {
      void run(item.id, () => adminApi.suspendTeacher(item.id));
    }
  };
  const onDelete = (item: UserListItem) => {
    if (window.confirm(`Delete ${item.firstName} ${item.lastName}? The account will be archived and can no longer sign in.`)) {
      void run(item.id, () => adminApi.deleteTeacher(item.id));
    }
  };

  const emptyText =
    tab === "pending"
      ? "No teachers waiting for administrator approval."
      : tab === "students"
        ? "No students found."
        : "No teachers found.";

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          Admin dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {user?.school ? `${user.school.name} — ` : ""}Approve teachers, manage teacher accounts, and oversee all students.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
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

      {tab === "manage" && (
        <div className="flex flex-wrap items-center gap-2">
          {(["APPROVED", "SUSPENDED", "REJECTED", "PENDING_ADMIN_APPROVAL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s ? "border-primary text-primary" : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {statusMeta[s].label}
            </button>
          ))}
        </div>
      )}

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
          {emptyText}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {tab === "pending" ? "Pending teacher requests" : tab === "manage" ? "Teacher management" : "Student overview"}
            </CardTitle>
            <CardDescription>
              {total} record{total === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Institution</th>
                  <th className="px-4 py-2 font-medium">
                    {tab === "students" ? "USN" : "Teacher ID / Dept"}
                  </th>
                  <th className="px-4 py-2 font-medium">
                    {tab === "students" ? "Semester" : "Registered"}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const prof = item.teacherProfile ?? item.studentProfile;
                  return (
                    <tr key={item.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {item.firstName} {item.lastName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <StatusChip status={item.status} />
                          {item.teacherProfile?.teacherId && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                              {item.teacherProfile.teacherId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" aria-hidden />
                          {prof?.school?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tab === "students"
                          ? item.studentProfile?.usn ?? "—"
                          : item.teacherProfile?.teacherId
                            ? `${item.teacherProfile.teacherId}${prof?.department ? ` (${prof.department})` : ""}`
                            : prof?.department ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tab === "students" ? item.studentProfile?.semester ?? "—" : formatDate(item.createdAt)}
                      </td>
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
                                onClick={() => onRejectTeacher(item)}
                                disabled={busyId === item.id}
                              >
                                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => void onApproveTeacher(item.id)}
                                disabled={busyId === item.id}
                              >
                                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                                Approve
                              </Button>
                            </>
                          )}
                          {tab === "manage" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600"
                                onClick={() => onSuspend(item)}
                                disabled={busyId === item.id || item.status === "SUSPENDED"}
                              >
                                <Ban className="h-4 w-4" aria-hidden />
                                Suspend
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => onDelete(item)}
                                disabled={busyId === item.id || !!item.archivedAt}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Delete
                              </Button>
                            </>
                          )}
                          {tab === "students" && (
                            <span className="text-xs text-muted-foreground">
                              <GraduationCap className="mr-1 inline h-4 w-4" aria-hidden />
                              View only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}