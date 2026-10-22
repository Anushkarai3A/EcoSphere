import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type SelectHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { assignmentApi, reviewApi } from "@/lib/api";
import { formatDate, proofTypes } from "@/lib/quests";
import type {
  AssignmentAsset,
  EvidenceAsset,
  ReviewAssignmentItem,
  ReviewAttemptDetail,
  ReviewAttemptItem,
  ReviewEvidenceItem,
  ReviewSummary,
  VerificationCheck,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const checkTone: Record<string, string> = {
  PASS: "border-emerald/40 bg-emerald/10 text-emerald",
  FAIL: "border-destructive/40 bg-destructive/10 text-destructive",
  WARN: "border-gold/40 bg-gold/10 text-gold",
  SKIP: "border-frost/30 bg-white/[0.06] text-ash",
};

const gradeTone: Record<string, string> = {
  UNGRADED: "border-gold/40 bg-gold/10 text-gold",
  GRADED: "border-emerald/40 bg-emerald/10 text-emerald",
  RETURNED: "border-cyan/40 bg-cyan/10 text-cyan",
};

const evidenceTone: Record<string, string> = {
  PENDING_VERIFICATION: "border-cyan/40 bg-cyan/10 text-cyan",
  PENDING_MANUAL_REVIEW: "border-gold/40 bg-gold/10 text-gold",
  AUTO_APPROVED: "border-emerald/40 bg-emerald/10 text-emerald",
  APPROVED: "border-emerald/40 bg-emerald/10 text-emerald",
  AUTO_REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
};

function CheckBadge({ status }: { status: string }) {
  return <span className={cn(chipBase, checkTone[status] ?? "border-frost/30 bg-white/[0.06] text-ash")}>{status}</span>;
}

function Checks({ checks }: { checks: VerificationCheck[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((check) => (
        <li
          key={check.id}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-frost/10 pb-1.5 font-micro text-[10px] uppercase last:border-0 last:pb-0"
        >
          <span className="text-ash">{check.checkType}</span>
          <span className="flex items-center gap-2">
            {check.message && <span className="text-ash">{check.message}</span>}
            <CheckBadge status={check.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function SummaryTile({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number | string;
  tone: string;
  loading: boolean;
}) {
  return (
    <div className="glass-panel flex min-w-[150px] flex-1 flex-col gap-1.5 rounded-[10px] p-4">
      <span className={cn("font-title text-[28px] font-semibold leading-none", tone)}>
        {loading ? "…" : value}
      </span>
      <span className="font-micro text-[10px] uppercase tracking-[0.06em] text-ash">{label}</span>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <span className="font-micro text-[10px] uppercase text-ash">
        {total} total · page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
          Prev
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
          Next
          <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

type Decision = "APPROVE" | "REJECT";

function ReviewPanel({
  item,
  onDecide,
  busy,
}: {
  item: ReviewEvidenceItem;
  onDecide: (submissionId: string, decision: Decision, bonusXp: number, note: string) => Promise<void>;
  busy: boolean;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [bonus, setBonus] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!decision) return;
    setSaving(true);
    setError(null);
    try {
      await onDecide(item.id, decision, Number(bonus) || 0, note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
      setSaving(false);
    }
  };

  if (decision === null) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setDecision("APPROVE")} disabled={busy} className="gap-1.5">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDecision("REJECT")}
          disabled={busy}
          className="border-destructive/40 text-destructive hover:border-destructive/70 hover:bg-destructive/10"
        >
          <XCircle className="mr-1 h-4 w-4" aria-hidden />
          Reject
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-micro text-[11px] uppercase text-bone">
          <Sparkles className={cn("h-3.5 w-3.5", decision === "APPROVE" ? "text-emerald" : "text-destructive")} aria-hidden />
          {decision === "APPROVE" ? "Approve & award XP" : "Reject submission"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDecision(null)} disabled={saving} aria-label="Close decision">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {decision === "APPROVE" ? (
        <div className="grid max-w-[200px] gap-1.5">
          <Label htmlFor="bonus">Bonus XP (max 100)</Label>
          <Input id="bonus" type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">{decision === "REJECT" ? "Reason (shown to the student)" : "Note (optional)"}</Label>
        <textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            decision === "REJECT"
              ? "e.g. Evidence doesn't match the quest location…"
              : "Anything worth recording with this review…"
          }
          className="w-full resize-none rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setDecision(null)} disabled={saving}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={saving || (decision === "REJECT" && !note.trim())}
          className={decision === "REJECT" ? "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25" : ""}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Confirm"}
        </Button>
      </div>
    </div>
  );
}

function GradeForm({
  item,
  onGrade,
  busy,
}: {
  item: ReviewAssignmentItem;
  onGrade: (
    submissionId: string,
    input: { score: number; gradeNotes?: string; returnForResubmission: boolean },
  ) => Promise<void>;
  busy: boolean;
}) {
  const maxMarks = item.assignment.maxMarks;
  const [score, setScore] = useState(item.score ?? maxMarks);
  const [notes, setNotes] = useState(item.gradeNotes ?? "");
  const [returnResub, setReturnResub] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const clamped = Math.max(0, Math.min(maxMarks, Number(score) || 0));
    setSaving(true);
    setError(null);
    try {
      await onGrade(item.id, {
        score: clamped,
        gradeNotes: notes.trim() || undefined,
        returnForResubmission: returnResub,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save grade");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-micro text-[11px] uppercase text-bone">Grade this submission</span>
        {item.gradeStatus === "GRADED" && item.gradedAt && (
          <span className="font-micro text-[10px] uppercase text-ash">
            {item.grader ? `Graded by ${item.grader.firstName} ${item.grader.lastName} · ` : ""}
            {formatDate(item.gradedAt)}
          </span>
        )}
      </div>
      <div className="grid max-w-[220px] gap-1.5">
        <Label htmlFor={`score-${item.id}`}>
          Score (0–{maxMarks}{item.assignment.passMarks != null ? ` · pass ${item.assignment.passMarks}` : ""})
        </Label>
        <Input
          id={`score-${item.id}`}
          type="number"
          min={0}
          max={maxMarks}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`notes-${item.id}`}>Feedback (optional)</Label>
        <textarea
          id={`notes-${item.id}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did the student do well / improve?"
          className="w-full resize-none rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35"
        />
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 font-micro text-[11px] uppercase text-ash">
        <input
          type="checkbox"
          checked={returnResub}
          onChange={(e) => setReturnResub(e.target.checked)}
          className="h-4 w-4 accent-cyan"
        />
        Return for resubmission
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void submit()} disabled={saving || busy}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save grade"}
        </Button>
      </div>
    </div>
  );
}

function EvidenceAssetPreview({
  asset,
  onOpen,
}: {
  asset: EvidenceAsset;
  onOpen: (src: string, alt: string) => void;
}) {
  const [broken, setBroken] = useState(false);
  const isImage = asset.assetType === "IMAGE" || asset.mimeType.startsWith("image/");
  const label = `${asset.assetType.toLowerCase()} · ${Math.round(Number(asset.sizeBytes) / 1024)} KB`;

  if (!isImage || broken) {
    return (
      <a
        href={asset.secureUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(chipBase, "transition-colors hover:border-emerald/60 hover:text-emerald")}
      >
        <Camera className="h-3.5 w-3.5" aria-hidden />
        {label}
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(asset.secureUrl, `${asset.assetType} evidence`)}
      className="group relative h-24 w-24 overflow-hidden rounded-[8px] border border-frost/25 transition-colors hover:border-emerald/50"
      aria-label="Open evidence photo"
    >
      <img
        src={asset.secureUrl}
        alt={`${asset.assetType} evidence`}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </button>
  );
}

function AssignmentAssetLink({ asset }: { asset: AssignmentAsset }) {
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      className={cn(chipBase, "transition-colors hover:border-emerald/60 hover:text-emerald")}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      {asset.filename ?? asset.kind.toLowerCase()}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

type TabKey = "assignments" | "attempts" | "evidence";

interface TabState<T> {
  loading: boolean;
  error: string | null;
  items: T[];
  total: number;
}

const initialTab = <T,>(): TabState<T> => ({ loading: true, error: null, items: [], total: 0 });

function dateParam(value: string, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`).toISOString();
}

export function TeacherReviewPage() {
  const [tab, setTab] = useState<TabKey>("assignments");

  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [assignStatus, setAssignStatus] = useState("");
  const [attemptResult, setAttemptResult] = useState("");
  const [evidenceStatus, setEvidenceStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [assignments, setAssignments] = useState<TabState<ReviewAssignmentItem>>(initialTab);
  const [attempts, setAttempts] = useState<TabState<ReviewAttemptItem>>(initialTab);
  const [evidence, setEvidence] = useState<TabState<ReviewEvidenceItem>>(initialTab);
  const [busy, setBusy] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [attemptDetails, setAttemptDetails] = useState<Record<string, ReviewAttemptDetail>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});

  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await reviewApi.summary();
      setSummary(res);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to load review summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchTab = useCallback(async () => {
    const common = {
      page,
      pageSize,
      search: search || undefined,
      from: dateParam(fromDate, false),
      to: dateParam(toDate, true),
    };

    if (tab === "assignments") {
      setAssignments((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await reviewApi.assignments({ ...common, status: assignStatus || undefined });
        setAssignments({ loading: false, error: null, items: res.items, total: res.total });
      } catch (err) {
        setAssignments((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load assignment submissions",
        }));
      }
      return;
    }

    if (tab === "attempts") {
      setAttempts((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await reviewApi.attempts({
          ...common,
          result: attemptResult === "passed" || attemptResult === "failed" ? attemptResult : undefined,
        });
        setAttempts({ loading: false, error: null, items: res.items, total: res.total });
      } catch (err) {
        setAttempts((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load quiz attempts",
        }));
      }
      return;
    }

    setEvidence((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await reviewApi.evidence({ ...common, status: evidenceStatus || undefined });
      setEvidence({ loading: false, error: null, items: res.items, total: res.total });
    } catch (err) {
      setEvidence((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load evidence submissions",
      }));
    }
  }, [tab, page, pageSize, search, assignStatus, attemptResult, evidenceStatus, fromDate, toDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void fetchTab();
  }, [fetchTab]);

  const refresh = useCallback(() => {
    void loadSummary();
    void fetchTab();
  }, [loadSummary, fetchTab]);

  const switchTab = (next: TabKey) => {
    setTab(next);
    setPage(1);
    setExpanded(null);
  };

  const applySearch = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setAssignStatus("");
    setAttemptResult("");
    setEvidenceStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  // Per tab: only that tab's own filter can make its empty state a "filtered"
  // empty — a leftover status filter on another tab must not mask the genuine
  // "nothing here yet" copy.
  const filtersActive = Boolean(
    search ||
      fromDate ||
      toDate ||
      (tab === "assignments" ? assignStatus : tab === "attempts" ? attemptResult : evidenceStatus),
  );

  const handleDecide = async (submissionId: string, decision: Decision, bonusXp: number, note: string) => {
    setBusy(true);
    try {
      await reviewApi.decide(submissionId, {
        decision,
        ...(decision === "APPROVE" ? { bonusXp } : {}),
        ...(note ? { note } : {}),
      });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleGrade = async (
    submissionId: string,
    input: { score: number; gradeNotes?: string; returnForResubmission: boolean },
  ) => {
    setBusy(true);
    try {
      await assignmentApi.gradeSubmission(submissionId, input);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (submissionId: string) => {
    setBusy(true);
    try {
      await reviewApi.verifyEvidence(submissionId);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to queue AI verification");
    } finally {
      setBusy(false);
    }
  };

  const loadAttemptDetail = useCallback(async (attemptId: string) => {
    setDetailLoading((s) => ({ ...s, [attemptId]: true }));
    setDetailErrors((s) => {
      const { [attemptId]: _drop, ...rest } = s;
      return rest;
    });
    try {
      const res = await reviewApi.attemptDetail(attemptId);
      setAttemptDetails((s) => ({ ...s, [attemptId]: res }));
    } catch (err) {
      setDetailErrors((s) => ({
        ...s,
        [attemptId]: err instanceof Error ? err.message : "Failed to load attempt detail",
      }));
    } finally {
      setDetailLoading((s) => ({ ...s, [attemptId]: false }));
    }
  }, []);

  const toggleExpand = (id: string, needsDetail: boolean) => {
    setExpanded((cur) => (cur === id ? null : id));
    if (needsDetail && expanded !== id && !attemptDetails[id]) {
      void loadAttemptDetail(id);
    }
  };

  const active = tab === "assignments" ? assignments : tab === "attempts" ? attempts : evidence;
  const evidenceTotal = summary ? Object.values(summary.evidence.byStatus).reduce((a, b) => a + b, 0) : null;

  const tabs: ReadonlyArray<{ key: TabKey; label: string; count: number | null }> = [
    { key: "assignments", label: "Assignments", count: summary ? summary.assignments.total : null },
    { key: "attempts", label: "Quiz attempts", count: summary ? summary.quizzes.attempts : null },
    { key: "evidence", label: "Quest evidence", count: evidenceTotal },
  ];

  const emptyCopy =
    tab === "assignments"
      ? "No submissions to your assignments yet."
      : tab === "attempts"
        ? "No quiz attempts yet."
        : "No evidence submissions yet.";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Teacher workspace</span>
          <span>Review dashboard</span>
        </MetaRow>
        <DisplayTitle lines={["REVIEW"]} />
        <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
          Assignments, quiz attempts and quest evidence — grade work, inspect answers, and resolve the
          evidence the AI could not auto-resolve.
        </p>
      </section>

      <Rule />

      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-stretch gap-3">
          <SummaryTile
            label="Pending review"
            value={summary?.headline.pendingReview ?? 0}
            tone="text-gold text-glow-gold"
            loading={summaryLoading}
          />
          <SummaryTile
            label="Awaiting AI"
            value={summary?.headline.awaitingAi ?? 0}
            tone="text-cyan"
            loading={summaryLoading}
          />
          <SummaryTile
            label="AI verified"
            value={summary?.headline.aiCompleted ?? 0}
            tone="text-emerald"
            loading={summaryLoading}
          />
          <SummaryTile
            label="AI failed / needs manual"
            value={summary?.headline.aiFailedOrManual ?? 0}
            tone="text-destructive"
            loading={summaryLoading}
          />
        </div>

        {summaryError && (
          <p
            role="alert"
            className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive"
          >
            Summary unavailable: {summaryError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-frost/20 bg-deep/60 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-micro text-[10px] uppercase tracking-[0.06em] transition-colors",
                  tab === t.key
                    ? "bg-emerald/15 text-emerald shadow-[inset_0_0_0_1px_rgba(46,207,143,0.45)]"
                    : "text-ash hover:text-bone",
                )}
                onClick={() => switchTab(t.key)}
              >
                {t.label}
                {t.count !== null && <span className="ml-1.5 opacity-70">{summaryLoading ? "…" : t.count}</span>}
              </button>
            ))}
          </div>
          <form className="flex items-center gap-2" onSubmit={applySearch}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" aria-hidden />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search student, title…"
                className="w-[220px] pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {tab === "assignments" && (
            <label className="grid gap-1.5">
              <span className="font-micro text-[10px] uppercase text-ash">Grade status</span>
              <Select
                value={assignStatus}
                onChange={(e) => {
                  setAssignStatus(e.target.value);
                  setPage(1);
                }}
                className="w-[170px]"
              >
                <option value="">All</option>
                <option value="UNGRADED">Ungraded</option>
                <option value="GRADED">Graded</option>
                <option value="RETURNED">Returned</option>
              </Select>
            </label>
          )}
          {tab === "attempts" && (
            <label className="grid gap-1.5">
              <span className="font-micro text-[10px] uppercase text-ash">Result</span>
              <Select
                value={attemptResult}
                onChange={(e) => {
                  setAttemptResult(e.target.value);
                  setPage(1);
                }}
                className="w-[150px]"
              >
                <option value="">All</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </Select>
            </label>
          )}
          {tab === "evidence" && (
            <label className="grid gap-1.5">
              <span className="font-micro text-[10px] uppercase text-ash">Status</span>
              <Select
                value={evidenceStatus}
                onChange={(e) => {
                  setEvidenceStatus(e.target.value);
                  setPage(1);
                }}
                className="w-[210px]"
              >
                <option value="">All</option>
                <option value="PENDING_MANUAL_REVIEW">Needs manual review</option>
                <option value="PENDING_VERIFICATION">Awaiting AI</option>
                <option value="AUTO_APPROVED">Auto-approved</option>
                <option value="AUTO_REJECTED">Auto-rejected</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </label>
          )}
          <label className="grid gap-1.5">
            <span className="font-micro text-[10px] uppercase text-ash">From</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-[160px]"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="font-micro text-[10px] uppercase text-ash">To</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-[160px]"
            />
          </label>
          {filtersActive && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {active.error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3"
          >
            <span className="inline-flex items-center gap-2 font-micro text-[11px] uppercase text-destructive">
              <AlertCircle className="h-4 w-4" aria-hidden />
              {active.error}
            </span>
            <Button size="sm" variant="outline" onClick={refresh}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
              Retry
            </Button>
          </div>
        )}

        {active.loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
            <p className="font-micro text-[11px] uppercase text-ash">
              Loading {tab === "assignments" ? "assignment submissions" : tab === "attempts" ? "quiz attempts" : "evidence"}…
            </p>
          </div>
        ) : !active.error && active.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
            <Logo className="h-12 w-12 opacity-80" />
            <p className="font-micro text-[11px] uppercase text-ash">
              {filtersActive ? "No results for these filters." : emptyCopy}
            </p>
            {filtersActive && (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <SectionHead
              kicker={`${active.total} total`}
              title={
                tab === "assignments" ? "Assignment submissions" : tab === "attempts" ? "Quiz attempts" : "Evidence"
              }
              right={<span className="font-micro text-[10px] uppercase text-ash">Teacher review</span>}
            />

            {tab === "assignments" && (
              <div className="flex flex-col">
                {assignments.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 border-t border-frost/10 py-5 transition-colors last:border-b hover:bg-white/[0.02]"
                  >
                    <button
                      type="button"
                      className="flex flex-wrap items-start justify-between gap-2 text-left"
                      onClick={() => toggleExpand(item.id, false)}
                      aria-expanded={expanded === item.id}
                    >
                      <div className="min-w-0">
                        <h3 className="font-display text-[22px] font-medium leading-tight text-bone">
                          {item.assignment.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-micro text-[10px] uppercase text-ash">
                          <span>
                            {item.student.firstName} {item.student.lastName}
                            {item.student.studentProfile?.usn ? ` · ${item.student.studentProfile.usn}` : ""}
                          </span>
                          <span>Submitted {formatDate(item.submittedAt)}</span>
                          {item.submissionStatus === "LATE" && (
                            <span className={cn(chipBase, "border-gold/40 bg-gold/10 text-gold")}>Late</span>
                          )}
                          {item.assignment.subject && <span>{item.assignment.subject}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {item.gradeStatus === "GRADED" && item.score != null && (
                          <span className="font-title text-[18px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
                            {item.score}/{item.assignment.maxMarks}
                          </span>
                        )}
                        <span className={cn(chipBase, gradeTone[item.gradeStatus] ?? "")}>{item.gradeStatus}</span>
                      </div>
                    </button>

                    {expanded === item.id && (
                      <div className="flex flex-col gap-3">
                        {item.assignment.description && (
                          <p className="max-w-2xl font-micro text-[11px] leading-[1.7] uppercase text-ash">
                            {item.assignment.description}
                          </p>
                        )}
                        {item.text && (
                          <div className="rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
                            <span className="font-micro text-[10px] uppercase text-ash">Student response</span>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone">{item.text}</p>
                          </div>
                        )}
                        {item.externalUrl && (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(chipBase, "w-fit transition-colors hover:border-emerald/60 hover:text-emerald")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            {item.externalUrl}
                          </a>
                        )}
                        {item.assets.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {item.assets.map((asset) => (
                              <AssignmentAssetLink key={asset.id} asset={asset} />
                            ))}
                          </div>
                        )}
                        <GradeForm item={item} onGrade={handleGrade} busy={busy} />
                      </div>
                    )}
                  </div>
                ))}
                <Pagination page={page} pageSize={pageSize} total={assignments.total} onPage={setPage} />
              </div>
            )}

            {tab === "attempts" && (
              <div className="flex flex-col">
                {attempts.items.map((item) => {
                  const detail = attemptDetails[item.id];
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 border-t border-frost/10 py-5 transition-colors last:border-b hover:bg-white/[0.02]"
                    >
                      <button
                        type="button"
                        className="flex flex-wrap items-start justify-between gap-2 text-left"
                        onClick={() => toggleExpand(item.id, true)}
                        aria-expanded={expanded === item.id}
                      >
                        <div className="min-w-0">
                          <h3 className="font-display text-[22px] font-medium leading-tight text-bone">
                            {item.quiz?.title ?? item.sideQuest?.title ?? "Quiz"}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-micro text-[10px] uppercase text-ash">
                            <span>
                              {item.student.firstName} {item.student.lastName}
                              {item.student.studentProfile?.usn ? ` · ${item.student.studentProfile.usn}` : ""}
                            </span>
                            <span>Submitted {formatDate(item.submittedAt)}</span>
                            {item.quiz && <span>Standalone quiz</span>}
                            {item.sideQuest && <span>Side quest</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-title text-[18px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
                            {item.score}/{item.maxScore}
                          </span>
                          <span
                            className={cn(chipBase, item.passed ? checkTone.PASS : checkTone.FAIL)}
                          >
                            {item.passed ? "Passed" : "Failed"}
                          </span>
                        </div>
                      </button>

                      {expanded === item.id && (
                        <div className="flex flex-col gap-3">
                          {detailLoading[item.id] ? (
                            <div className="flex items-center gap-2 py-4 font-micro text-[11px] uppercase text-ash">
                              <Loader2 className="h-4 w-4 animate-spin text-emerald" aria-hidden />
                              Loading questions…
                            </div>
                          ) : detailErrors[item.id] ? (
                            <p
                              role="alert"
                              className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive"
                            >
                              {detailErrors[item.id]}
                            </p>
                          ) : detail ? (
                            <>
                              <div className="flex flex-wrap items-center gap-3 font-micro text-[10px] uppercase text-ash">
                                <span className={cn(chipBase, item.passed ? checkTone.PASS : checkTone.FAIL)}>
                                  {item.passed ? "Passed" : "Failed"}
                                </span>
                                <span>
                                  Score {item.score}/{item.maxScore}
                                  {(() => {
                                    const threshold = detail.quiz?.passThreshold ?? detail.sideQuest?.passThreshold;
                                    return threshold != null ? ` · pass threshold ${threshold}%` : "";
                                  })()}
                                </span>
                              </div>
                              <ol className="flex flex-col gap-3">
                                {detail.questions.map((q) => (
                                  <li key={q.id} className="rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="font-micro text-[11px] uppercase leading-[1.6] text-bone">
                                        Q{q.position}. {q.prompt}
                                      </p>
                                      <span
                                        className={cn(
                                          chipBase,
                                          q.unanswered
                                            ? "border-gold/40 bg-gold/10 text-gold"
                                            : q.correct
                                              ? checkTone.PASS
                                              : checkTone.FAIL,
                                        )}
                                      >
                                        {q.unanswered ? "Not answered" : q.correct ? "Correct" : "Incorrect"}
                                      </span>
                                    </div>
                                    <ul className="mt-2.5 flex flex-col gap-1">
                                      {q.options.map((opt, idx) => {
                                        const chosen = q.selectedIndex === idx;
                                        const correct = q.correctIndex === idx;
                                        return (
                                          <li
                                            key={idx}
                                            className={cn(
                                              "flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 font-micro text-[11px] uppercase",
                                              correct
                                                ? "border-emerald/40 bg-emerald/10 text-emerald"
                                                : chosen
                                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                                  : "border-transparent text-ash",
                                            )}
                                          >
                                            <span className="w-4 shrink-0">{String.fromCharCode(65 + idx)}</span>
                                            <span className="min-w-0 flex-1">{opt.text}</span>
                                            {chosen && <span className="shrink-0">· chosen</span>}
                                            {correct && <span className="shrink-0">· correct</span>}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                    {q.explanation && (
                                      <p className="mt-2.5 border-t border-frost/10 pt-2.5 font-micro text-[10px] uppercase leading-[1.6] text-ash">
                                        Explanation: {q.explanation}
                                      </p>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Pagination page={page} pageSize={pageSize} total={attempts.total} onPage={setPage} />
              </div>
            )}

            {tab === "evidence" && (
              <div className="flex flex-col">
                {evidence.items.map((item) => {
                  const v = item.verification;
                  const proof = proofTypes.find((p) => p.value === item.quest.requiredProofType);
                  const runActive = v?.status === "RUNNING" || v?.status === "PENDING";
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 border-t border-frost/10 py-5 transition-colors last:border-b hover:bg-white/[0.02]"
                    >
                      <button
                        type="button"
                        className="flex flex-wrap items-start justify-between gap-2 text-left"
                        onClick={() => toggleExpand(item.id, false)}
                        aria-expanded={expanded === item.id}
                      >
                        <div className="min-w-0">
                          <h3 className="font-display text-[22px] font-medium leading-tight text-bone">
                            {item.quest.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-micro text-[10px] uppercase text-ash">
                            <span>
                              {item.student.firstName} {item.student.lastName}
                              {item.student.studentProfile?.usn ? ` · ${item.student.studentProfile.usn}` : ""}
                            </span>
                            <span>Submitted {formatDate(item.submittedAt)}</span>
                            {item.reSubmissionOf && (
                              <span className={cn(chipBase, "border-cyan/40 bg-cyan/10 text-cyan")}>Resubmission</span>
                            )}
                            {proof && <span>{proof.label}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-title text-[18px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
                            {Number(item.quest.xpReward)} XP
                          </span>
                          <span className={cn(chipBase, evidenceTone[item.status] ?? "")}>
                            {item.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </button>

                      {expanded === item.id && (
                        <div className="flex flex-col gap-3">
                          {item.quest.description && (
                            <p className="max-w-2xl font-micro text-[11px] leading-[1.7] uppercase text-ash">
                              {item.quest.description}
                            </p>
                          )}
                          {item.notes && (
                            <div className="rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
                              <span className="font-micro text-[10px] uppercase text-ash">Student note</span>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone">{item.notes}</p>
                            </div>
                          )}

                          {item.assets.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {item.assets.map((asset) => (
                                <EvidenceAssetPreview
                                  key={asset.id}
                                  asset={asset}
                                  onOpen={(src, alt) => setLightbox({ src, alt })}
                                />
                              ))}
                            </div>
                          )}

                          {v ? (
                            <div className="rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">
                                  <Sparkles className="h-3.5 w-3.5 text-cyan" aria-hidden />
                                  AI verification ({v.status})
                                </span>
                                <span className="flex flex-wrap items-center gap-2 font-micro text-[10px] uppercase">
                                  {v.overallRecommendation && (
                                    <span className={cn(chipBase, "border-frost/30 bg-white/[0.06] text-bone")}>
                                      {v.overallRecommendation}
                                    </span>
                                  )}
                                  <span className="text-ash">
                                    {v.fraudRisk ? `${v.fraudRisk} risk · ` : ""}
                                    {Number(v.overallConfidence ?? 0) * 100}% confidence
                                  </span>
                                </span>
                              </div>
                              {v.summary && (
                                <p className="mt-2 font-micro text-[11px] uppercase leading-[1.6] text-ash">{v.summary}</p>
                              )}
                              {v.errorMessage && (
                                <p className="mt-2 font-micro text-[11px] uppercase leading-[1.6] text-destructive">
                                  {v.errorMessage}
                                </p>
                              )}
                              {v.checks.length > 0 && (
                                <div className="mt-3 border-t border-frost/10 pt-3">
                                  <Checks checks={v.checks} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="font-micro text-[11px] uppercase text-ash">
                              No AI verification recorded for this submission.
                            </p>
                          )}

                          {item.status === "PENDING_MANUAL_REVIEW" ? (
                            <ReviewPanel item={item} onDecide={handleDecide} busy={busy} />
                          ) : item.status === "PENDING_VERIFICATION" ? (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="font-micro text-[11px] uppercase text-ash">
                                {runActive
                                  ? "AI verification is queued / running."
                                  : "AI verification has not completed — you can re-queue it."}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleVerify(item.id)}
                                disabled={busy || runActive}
                              >
                                <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
                                Run AI verification
                              </Button>
                            </div>
                          ) : (
                            <div className="rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
                              <span className="font-micro text-[11px] uppercase text-bone">
                                {item.status.replace(/_/g, " ")}
                              </span>
                              {item.reviewNote && (
                                <p className="mt-2 font-micro text-[11px] uppercase leading-[1.6] text-ash">
                                  Review note: {item.reviewNote}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Pagination page={page} pageSize={pageSize} total={evidence.total} onPage={setPage} />
              </div>
            )}
          </>
        )}
      </section>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Evidence photo preview"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-h-full max-w-full rounded-[10px] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-10 w-10"
            onClick={() => setLightbox(null)}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
