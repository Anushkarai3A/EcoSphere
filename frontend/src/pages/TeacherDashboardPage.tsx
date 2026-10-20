import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileText,
  GraduationCap,
  Layers,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreateQuestModal } from "@/components/dashboard/CreateQuestModal";
import { DashboardQuestSection } from "@/components/dashboard/DashboardQuestSection";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { teacherApi, type ListUsersParams } from "@/lib/api";
import { formatDate } from "@/lib/quests";
import type { UserListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { statusMeta } from "@/components/userStatus";
import { UserDetailsDialog } from "@/components/UserDetailsDialog";

const PAGE_SIZE = 10;

type TeacherTab = "pending" | "approved";

const tabs: ReadonlyArray<{ value: TeacherTab; label: string }> = [
  { value: "pending", label: "Pending student requests" },
  { value: "approved", label: "Approved students" },
];

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const statusTone: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: "border-cyan/40 bg-cyan/10 text-cyan",
  PENDING_TEACHER_APPROVAL: "border-cyan/40 bg-cyan/10 text-cyan",
  APPROVED: "border-emerald/40 bg-emerald/10 text-emerald",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  SUSPENDED: "border-gold/40 bg-gold/10 text-gold",
};

const tileTone = {
  emerald: { box: "border-emerald/35 bg-emerald/10", text: "text-emerald" },
  cyan: { box: "border-cyan/35 bg-cyan/10", text: "text-cyan" },
  gold: { box: "border-gold/35 bg-gold/10", text: "text-gold" },
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
      {/* HERO */}
      <section className="relative isolate overflow-hidden rounded-[20px] border border-frost/15 animate-gallery-rise">
        <img
          src="/assets/world-map.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full scale-105 object-cover object-[64%_40%] opacity-25"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(3,18,26,0.96)_0%,rgba(3,18,26,0.86)_46%,rgba(6,24,34,0.55)_100%)]"
        />
        <div className="flex flex-col gap-5 px-6 py-10 sm:px-10 sm:py-12">
          <MetaRow>
            <span>Teacher workspace</span>
            <span>{total} students</span>
          </MetaRow>
          <DisplayTitle lines={["TEACHER", "DASHBOARD"]} />
          <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
            Approve student registration requests, manage your student roster, and search by student.
          </p>
          <div className="flex flex-wrap gap-3">
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
          </div>
        </div>
      </section>

      <Rule />

      {/* QUESTS */}
      <section className="flex flex-col gap-5">
        <DashboardQuestSection mode="teacher" onGoToMyQuests={() => navigate("/app/teacher/quests")} onCreateQuest={() => setCreateOpen(true)} />
      </section>

      <Rule />

      {/* ROSTER */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Roster"
          title="Manage students"
          right={
            <span className="font-micro text-[10px] uppercase text-ash">
              {loading ? "Loading…" : `${total} student${total === 1 ? "" : "s"}`}
            </span>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricTile
            icon={Users}
            value={loading ? "…" : String(total)}
            label={tab === "pending" ? "Pending requests" : "Approved students"}
          />
          <MetricTile
            icon={LayoutList}
            value={loading ? "…" : String(items.length)}
            label="On this page"
            tone="cyan"
          />
          <MetricTile icon={Layers} value={loading ? "…" : String(totalPages)} label="Pages" tone="gold" />
        </div>

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

        {error && (
          <p role="alert" className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-16 font-micro text-[11px] uppercase text-ash">
            <Loader2 className="h-4 w-4 animate-spin text-emerald" aria-hidden /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
            <Logo className="h-12 w-12 opacity-80" />
            <p className="font-micro text-[11px] uppercase text-ash">
              {tab === "pending" ? "No students waiting for your approval." : "No approved students found."}
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-[22px]">
                {tab === "pending" ? "Pending student requests" : "Approved students"}
              </CardTitle>
              <CardDescription>
                {total} student{total === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-frost/20 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">
                  <tr>
                    <th className="px-4 py-3 font-normal">Name</th>
                    <th className="px-4 py-3 font-normal">Email</th>
                    <th className="px-4 py-3 font-normal">USN</th>
                    <th className="px-4 py-3 font-normal">Semester</th>
                    <th className="px-4 py-3 font-normal">Department</th>
                    <th className="px-4 py-3 font-normal">Registered</th>
                    <th className="px-4 py-3 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-frost/10 transition-colors last:border-0 hover:bg-white/[0.04]">
                      <td className="px-4 py-3">
                        <div className="font-display text-[16px] font-medium leading-tight text-bone">
                          {item.firstName} {item.lastName}
                        </div>
                        <span
                          className={cn(
                            chipBase,
                            "mt-1.5",
                            statusTone[item.status] ?? "border-frost/30 bg-white/[0.06] text-ash",
                          )}
                        >
                          {statusMeta[item.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ash">{item.email}</td>
                      <td className="px-4 py-3 font-micro text-[11px] uppercase text-ash">{item.studentProfile?.usn ?? "—"}</td>
                      <td className="px-4 py-3 font-micro text-[11px] uppercase text-ash">{item.studentProfile?.semester ?? "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-ash">
                        <span className="inline-flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5 text-turquoise" aria-hidden />
                          {item.studentProfile?.department ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-micro text-[11px] uppercase text-ash">{formatDate(item.createdAt)}</td>
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
                                onClick={() => onReject(item)}
                                disabled={busyId === item.id}
                                className="text-destructive"
                              >
                                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => void run(item.id, () => teacherApi.approveStudent(item.id))}
                                disabled={busyId === item.id}
                              >
                                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                                Approve
                              </Button>
                            </>
                          )}
                          {tab === "approved" && (
                            <span className="inline-flex items-center gap-1 font-micro text-[10px] uppercase text-ash">
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

      <CreateQuestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
