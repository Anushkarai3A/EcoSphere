import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Hourglass,
  Layers,
  Loader2,
  Search,
  Trash2,
  UserRound,
  Users,
  XCircle,
  Ban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { adminApi, type ListUsersParams } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/quests";
import type { UserListItem, UserStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { statusMeta } from "@/components/userStatus";
import { UserDetailsDialog } from "@/components/UserDetailsDialog";

const PAGE_SIZE = 10;

type AdminTab = "pending" | "manage" | "students";

const tabs: ReadonlyArray<{ value: AdminTab; label: string }> = [
  { value: "pending", label: "Pending teacher requests" },
  { value: "manage", label: "Teacher management" },
  { value: "students", label: "Student overview" },
];

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const statusTone: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: "border-gold/40 bg-gold/10 text-gold",
  PENDING_TEACHER_APPROVAL: "border-gold/40 bg-gold/10 text-gold",
  APPROVED: "border-emerald/40 bg-emerald/10 text-emerald",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  SUSPENDED: "border-orange/40 bg-orange/10 text-orange",
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
  const [counts, setCounts] = useState<{ teachers: number | null; students: number | null; pending: number | null }>({
    teachers: null,
    students: null,
    pending: null,
  });

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

  // Platform-wide metric tiles — read-only counts, failures degrade to "…".
  useEffect(() => {
    let active = true;
    void Promise.all([
      adminApi.listTeachers({ page: 1, pageSize: 1 }).catch(() => null),
      adminApi.listStudents({ page: 1, pageSize: 1 }).catch(() => null),
      adminApi
        .listTeachers({ status: "PENDING_ADMIN_APPROVAL", page: 1, pageSize: 1 })
        .catch(() => null),
    ]).then(([teachers, students, pending]) => {
      if (!active) return;
      setCounts({
        teachers: teachers?.total ?? null,
        students: students?.total ?? null,
        pending: pending?.total ?? null,
      });
    });
    return () => {
      active = false;
    };
  }, []);

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Admin console</span>
          <span>
            {total} record{total === 1 ? "" : "s"}
          </span>
        </MetaRow>
        <DisplayTitle lines={["ADMIN", "DASHBOARD"]} />
        <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
          {user?.school ? `${user.school.name} — ` : ""}Approve teachers, manage teacher accounts, and oversee all
          students.
        </p>
      </section>

      <Rule />

      {/* METRICS */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Overview"
          title="Platform metrics"
          right={<span className="font-micro text-[10px] uppercase text-ash">Live counts</span>}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            icon={Users}
            value={counts.teachers == null ? "…" : counts.teachers.toLocaleString()}
            label="Teachers"
          />
          <MetricTile
            icon={GraduationCap}
            value={counts.students == null ? "…" : counts.students.toLocaleString()}
            label="Students"
            tone="cyan"
          />
          <MetricTile
            icon={Hourglass}
            value={counts.pending == null ? "…" : counts.pending.toLocaleString()}
            label="Pending approvals"
            tone="gold"
          />
          <MetricTile
            icon={Layers}
            value={loading ? "…" : String(total)}
            label="Records in view"
            tone="ash"
          />
        </div>
      </section>

      <Rule />

      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Directory"
          title={tab === "pending" ? "Approval queue" : tab === "manage" ? "Teacher management" : "Student overview"}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-frost/20 bg-deep/60 p-1">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-micro text-[10px] uppercase tracking-[0.06em] transition-colors",
                  tab === t.value
                    ? "bg-emerald/15 text-emerald shadow-[inset_0_0_0_1px_rgba(46,207,143,0.45)]"
                    : "text-ash hover:text-bone",
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" aria-hidden />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, USN…"
                className="w-[220px] pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
        </div>

        {tab === "manage" && (
          <div className="flex flex-wrap gap-2">
            {(["APPROVED", "SUSPENDED", "REJECTED", "PENDING_ADMIN_APPROVAL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 font-micro text-[10px] uppercase tracking-[0.06em] transition-colors",
                  statusFilter === s
                    ? statusTone[s]
                    : "border-frost/30 bg-white/[0.04] text-ash hover:text-bone",
                )}
              >
                {statusMeta[s].label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
            <p className="font-micro text-[11px] uppercase text-ash">Loading…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
            <Logo className="h-12 w-12 opacity-80" />
            <p className="font-micro text-[11px] uppercase text-ash">{emptyText}</p>
          </div>
        ) : (
          <div className="glass-panel rounded-[10px] p-5">
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-frost/25 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">
                  <tr>
                    <th className="px-4 py-3 font-normal">Name</th>
                    <th className="px-4 py-3 font-normal">Email</th>
                    <th className="px-4 py-3 font-normal">Institution</th>
                    <th className="px-4 py-3 font-normal">{tab === "students" ? "USN" : "Teacher ID / Dept"}</th>
                    <th className="px-4 py-3 font-normal">{tab === "students" ? "Semester" : "Registered"}</th>
                    <th className="px-4 py-3 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const prof = item.teacherProfile ?? item.studentProfile;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-frost/10 transition-colors last:border-0 hover:bg-white/[0.04]"
                      >
                        <td className="px-4 py-3">
                          <div className="font-display text-[16px] font-medium leading-tight text-bone">
                            {item.firstName} {item.lastName}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={cn(chipBase, statusTone[item.status] ?? "border-frost/30 bg-white/[0.06] text-ash")}>
                              {statusMeta[item.status].label}
                            </span>
                            {item.teacherProfile?.teacherId && (
                              <span className={cn(chipBase, "border-cyan/40 bg-cyan/10 text-cyan")}>
                                {item.teacherProfile.teacherId}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-micro text-[11px] uppercase text-ash">{item.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase text-ash">
                            <Building2 className="h-3.5 w-3.5" aria-hidden />
                            {prof?.school?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-micro text-[11px] uppercase text-ash">
                          {tab === "students"
                            ? item.studentProfile?.usn ?? "—"
                            : item.teacherProfile?.teacherId
                              ? `${item.teacherProfile.teacherId}${prof?.department ? ` (${prof.department})` : ""}`
                              : prof?.department ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-micro text-[11px] uppercase text-ash">
                          {tab === "students" ? item.studentProfile?.semester ?? "—" : formatDate(item.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setDetail(item)}>
                              <UserRound className="h-4 w-4" aria-hidden />
                              View
                            </Button>
                            {tab === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive/40 text-destructive hover:border-destructive/70 hover:bg-destructive/10"
                                  onClick={() => onRejectTeacher(item)}
                                  disabled={busyId === item.id}
                                >
                                  {busyId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  ) : (
                                    <XCircle className="h-4 w-4" aria-hidden />
                                  )}
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => void onApproveTeacher(item.id)}
                                  disabled={busyId === item.id}
                                >
                                  {busyId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                                  )}
                                  Approve
                                </Button>
                              </>
                            )}
                            {tab === "manage" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onSuspend(item)}
                                  disabled={busyId === item.id || item.status === "SUSPENDED"}
                                >
                                  <Ban className="h-4 w-4" aria-hidden />
                                  Suspend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive/40 text-destructive hover:border-destructive/70 hover:bg-destructive/10"
                                  onClick={() => onDelete(item)}
                                  disabled={busyId === item.id || !!item.archivedAt}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                  Delete
                                </Button>
                              </>
                            )}
                            {tab === "students" && (
                              <span className="inline-flex items-center gap-1 font-micro text-[10px] uppercase text-ash">
                                <GraduationCap className="h-3.5 w-3.5" aria-hidden />
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
            </div>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 font-micro text-[11px] uppercase text-ash">
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
      </section>

      <UserDetailsDialog item={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
