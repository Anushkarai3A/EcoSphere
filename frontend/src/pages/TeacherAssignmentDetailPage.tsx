import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { assignmentApi } from "@/lib/api";
import type { Assignment, AssignmentSubmission, RubricCriterion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const statusTone: Record<string, string> = {
  DRAFT: "border-frost/30 bg-white/[0.06] text-ash",
  PUBLISHED: "border-emerald/40 bg-emerald/10 text-emerald",
  SCHEDULED: "border-cyan/40 bg-cyan/10 text-cyan",
  CLOSED: "border-gold/40 bg-gold/10 text-gold",
};

const tileTone = {
  emerald: { box: "border-emerald/35 bg-emerald/10", text: "text-emerald" },
  cyan: { box: "border-cyan/35 bg-cyan/10", text: "text-cyan" },
  gold: { box: "border-gold/35 bg-gold/10", text: "text-gold" },
  ash: { box: "border-frost/30 bg-white/[0.06]", text: "text-ash" },
} as const;

const fieldClass =
  "w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35";

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

export function TeacherAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Submission for Grading Modal
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeNotes, setGradeNotes] = useState<string>("");
  const [returnForResubmission, setReturnForResubmission] = useState<boolean>(false);
  const [rubricScores, setRubricScores] = useState<Record<number, number>>({});
  const [gradingSubmitting, setGradingSubmitting] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await assignmentApi.get(id);
      setAssignment(res.assignment);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load assignment details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const openGradingModal = (sub: AssignmentSubmission) => {
    setGradingSubmission(sub);
    setGradeScore(sub.score ?? assignment?.maxMarks ?? 100);
    setGradeNotes(sub.gradeNotes || "");
    setReturnForResubmission(false);

    // Initialize rubric scores if rubric criteria exist
    const initRubric: Record<number, number> = {};
    if (assignment?.rubric && Array.isArray(assignment.rubric)) {
      assignment.rubric.forEach((r: RubricCriterion, idx: number) => {
        initRubric[idx] = Number(r.maxMarks);
      });
    }
    setRubricScores(initRubric);
  };

  const handleRubricScoreChange = (idx: number, val: number) => {
    const updated = { ...rubricScores, [idx]: val };
    setRubricScores(updated);

    // Auto calculate total score
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);
    setGradeScore(sum);
  };

  const handleGradeSubmit = async () => {
    if (!gradingSubmission) return;
    setGradingSubmitting(true);
    try {
      await assignmentApi.gradeSubmission(gradingSubmission.id, {
        score: gradeScore,
        gradeNotes: gradeNotes.trim() || undefined,
        returnForResubmission,
      });
      setGradingSubmission(null);
      fetchDetail();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to grade submission");
    } finally {
      setGradingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald" aria-hidden />
        <p className="font-micro text-[11px] uppercase text-ash">Loading assignment dashboard...</p>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <Logo className="h-14 w-14 opacity-80" />
        <span className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 font-micro text-[10px] uppercase text-destructive">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Load failed
        </span>
        <h2 className="font-display text-[26px] font-medium leading-[1.15] text-bone">
          {error || "Assignment not found"}
        </h2>
        <Button onClick={() => navigate("/app/teacher/assignments")}>Back to Assignments</Button>
      </div>
    );
  }

  const submissions = assignment.submissions || [];
  const gradedCount = submissions.filter((s) => s.gradeStatus === "GRADED").length;
  const pendingCount = submissions.filter((s) => s.gradeStatus === "UNGRADED").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
      {/* HERO */}
      <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/teacher/assignments")}
            className="h-9 w-9"
            aria-label="Back to assignments"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <MetaRow>
            <span>{assignment.subject || "Assignment"}</span>
            <span className={cn(chipBase, "border-frost/30 bg-white/[0.06] text-ash")}>
              {assignment.type.replace("_", " ")}
            </span>
          </MetaRow>
        </div>
        <DisplayTitle lines={["REVIEW"]} />
        <p className="max-w-2xl font-display text-[30px] font-medium leading-[1.1] text-bone">{assignment.title}</p>
        <div className="flex flex-wrap items-center gap-3">
          {assignment.status === "DRAFT" ? (
            <Button
              onClick={async () => {
                await assignmentApi.publish(assignment.id);
                fetchDetail();
              }}
              className="gap-2"
            >
              <Send className="h-4 w-4" aria-hidden />
              Publish Now
            </Button>
          ) : (
            <span className={cn(chipBase, statusTone[assignment.status] ?? "border-emerald/40 bg-emerald/10 text-emerald")}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {assignment.status === "PUBLISHED" ? "Published" : assignment.status}
            </span>
          )}
        </div>
      </section>

      <Rule />

      {/* METRICS */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Overview" title="Submissions at a glance" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile icon={FileCheck} value={String(submissions.length)} label="Total submissions" />
          <MetricTile icon={Loader2} value={String(pendingCount)} label="Pending review" tone="gold" />
          <MetricTile icon={CheckCircle2} value={String(gradedCount)} label="Graded" tone="cyan" />
          <MetricTile icon={Award} value={String(assignment.maxMarks)} label="Maximum marks" tone="ash" />
        </div>
      </section>

      <Rule />

      {/* INSTRUCTIONS */}
      <section className="glass-panel flex flex-col gap-4 rounded-[10px] p-5 sm:p-6">
        <h3 className="font-display text-[22px] font-medium leading-tight text-bone">Instructions & configuration</h3>
        <p className="whitespace-pre-line text-sm leading-[1.7] text-ash">{assignment.description}</p>

        <div className="grid grid-cols-1 gap-4 border-t border-frost/15 pt-4 font-micro text-[11px] sm:grid-cols-3">
          <div>
            <span className="block uppercase text-ash">Due date</span>
            <span className="mt-1 block text-bone">
              {new Date(assignment.dueAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div>
            <span className="block uppercase text-ash">Submission format</span>
            <span className="mt-1 block text-bone">{assignment.submissionType}</span>
          </div>
          <div>
            <span className="block uppercase text-ash">XP reward</span>
            <span className="mt-1 block font-title text-[16px] font-semibold tracking-normal text-gold">
              +{Number(assignment.xpReward)} XP
            </span>
          </div>
        </div>

        {/* Attached Learning Materials */}
        {assignment.materials && assignment.materials.length > 0 && (
          <div className="border-t border-frost/15 pt-4">
            <h4 className="mb-2 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">
              Learning resources ({assignment.materials.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {assignment.materials.map((m) => (
                <a
                  key={m.id}
                  href={m.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(chipBase, "transition-colors hover:border-emerald/60 hover:text-emerald")}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  {m.title}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      <Rule />

      {/* STUDENT SUBMISSIONS */}
      <section className="glass-panel flex flex-col gap-4 rounded-[10px] p-5 sm:p-6">
        <SectionHead
          kicker="Submissions"
          title="Student submissions"
          right={<span className="font-micro text-[10px] uppercase text-ash">{submissions.length} total entries</span>}
        />

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
            <Logo className="h-12 w-12 opacity-80" />
            <p className="font-micro text-[11px] uppercase text-ash">No submissions received yet.</p>
          </div>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-frost/25 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">
                <tr>
                  <th className="px-3 py-3 font-normal">Student</th>
                  <th className="px-3 py-3 font-normal">Attempt</th>
                  <th className="px-3 py-3 font-normal">Status</th>
                  <th className="px-3 py-3 font-normal">Submitted at</th>
                  <th className="px-3 py-3 font-normal">Marks</th>
                  <th className="px-3 py-3 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => {
                  const studentName = sub.student ? `${sub.student.firstName} ${sub.student.lastName}` : "Unknown Student";
                  const isGraded = sub.gradeStatus === "GRADED";
                  const isReturned = sub.gradeStatus === "RETURNED";

                  return (
                    <tr key={sub.id} className="border-b border-frost/10 transition-colors last:border-0 hover:bg-white/[0.04]">
                      <td className="px-3 py-3">
                        <div className="font-display text-[16px] font-medium leading-tight text-bone">{studentName}</div>
                        <div className="mt-1 font-micro text-[10px] uppercase text-ash">{sub.student?.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn(chipBase, "border-frost/30 bg-white/[0.06] text-ash")}>
                          Attempt {sub.attempt}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {sub.submissionStatus === "LATE" ? (
                          <span className={cn(chipBase, "border-gold/40 bg-gold/10 text-gold")}>Late</span>
                        ) : (
                          <span className={cn(chipBase, "border-emerald/40 bg-emerald/10 text-emerald")}>On time</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-micro text-[10px] uppercase text-ash">
                        {new Date(sub.submittedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        {isGraded ? (
                          <span className="font-title text-[18px] font-semibold leading-none text-gold">
                            {sub.score}
                            <span className="text-bone/70"> / {assignment.maxMarks}</span>
                          </span>
                        ) : isReturned ? (
                          <span className={cn(chipBase, "border-gold/40 bg-gold/10 text-gold")}>Returned</span>
                        ) : (
                          <span className={cn(chipBase, "border-frost/30 bg-white/[0.06] text-ash")}>Ungraded</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openGradingModal(sub)}>
                          <FileCheck className="h-3.5 w-3.5" aria-hidden />
                          {isGraded ? "Edit Grade" : "Review & Grade"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Grading Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-[20px] bg-[#04171d]/95 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-frost/15 pb-3">
              <div className="min-w-0">
                <h3 className="font-display text-[22px] font-medium leading-tight text-bone">Grade submission</h3>
                <p className="mt-1 font-micro text-[10px] uppercase text-ash">
                  {gradingSubmission.student?.firstName} {gradingSubmission.student?.lastName} (Attempt #
                  {gradingSubmission.attempt})
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setGradingSubmission(null)} className="h-8 w-8" aria-label="Close">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            {/* Submission Content Review */}
            <div className="space-y-3 rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
              <h4 className="font-micro text-[10px] uppercase tracking-[0.08em] text-ash">Submitted work</h4>
              {gradingSubmission.text && (
                <div className="whitespace-pre-line rounded-[10px] border border-frost/15 bg-deep/60 p-3 text-sm text-bone">
                  {gradingSubmission.text}
                </div>
              )}

              {gradingSubmission.externalUrl && (
                <div>
                  <a
                    href={gradingSubmission.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-micro text-[11px] text-cyan hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {gradingSubmission.externalUrl}
                  </a>
                </div>
              )}

              {gradingSubmission.assets && gradingSubmission.assets.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {gradingSubmission.assets.map((asset) => (
                    <a
                      key={asset.id}
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(chipBase, "transition-colors hover:border-emerald/60 hover:text-emerald")}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      {asset.filename || "Uploaded File"}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Rubric Evaluator */}
            {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-micro text-[10px] uppercase tracking-[0.08em] text-ash">Rubric evaluation</h4>
                <div className="space-y-2">
                  {assignment.rubric.map((r: RubricCriterion, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-4 rounded-[10px] border border-frost/20 bg-white/[0.04] p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-bone">{r.criterion}</div>
                        {r.description && <div className="mt-0.5 text-[11px] text-ash">{r.description}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={r.maxMarks}
                          value={rubricScores[idx] ?? r.maxMarks}
                          onChange={(e) => handleRubricScoreChange(idx, Number(e.target.value))}
                          className="h-9 w-16 px-2 text-center text-xs"
                        />
                        <span className="font-micro text-[10px] uppercase text-ash">/ {r.maxMarks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score & Notes Form */}
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="grade-score" className="block font-micro text-[10px] uppercase leading-none tracking-[0.16em] text-ash">
                  Final score (out of {assignment.maxMarks})
                </label>
                <Input
                  id="grade-score"
                  type="number"
                  min={0}
                  max={assignment.maxMarks}
                  value={gradeScore}
                  onChange={(e) => setGradeScore(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="grade-notes" className="block font-micro text-[10px] uppercase leading-none tracking-[0.16em] text-ash">
                  Teacher feedback / notes
                </label>
                <textarea
                  id="grade-notes"
                  rows={3}
                  placeholder="Provide constructive feedback for the student..."
                  value={gradeNotes}
                  onChange={(e) => setGradeNotes(e.target.value)}
                  className={cn(fieldClass, "resize-y")}
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="returnResub"
                  checked={returnForResubmission}
                  onChange={(e) => setReturnForResubmission(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-[2px] border-frost/40 accent-emerald"
                />
                <label htmlFor="returnResub" className="font-micro text-[11px] uppercase text-bone">
                  Return to student for resubmission (Requires revision)
                </label>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-frost/15 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Button variant="ghost" onClick={() => setGradingSubmission(null)}>
                Cancel
              </Button>
              <Button disabled={gradingSubmitting} onClick={handleGradeSubmit} className="gap-2">
                <Award className="h-4 w-4" aria-hidden />
                {gradingSubmitting ? "Saving Grade..." : "Submit Grade & Award XP"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
