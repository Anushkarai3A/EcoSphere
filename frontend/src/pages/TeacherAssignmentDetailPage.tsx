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
  RefreshCw,
  Send,
  Users,
  X,
} from "lucide-react";
import { assignmentApi } from "@/lib/api";
import type { Assignment, AssignmentSubmission, RubricCriterion } from "@/lib/types";
import { Button } from "@/components/ui/button";

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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium">Loading assignment dashboard...</p>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12 text-center">
        <div className="rounded-full bg-destructive/10 p-4 text-destructive inline-block">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold">{error || "Assignment not found"}</h2>
        <Button onClick={() => navigate("/app/teacher/assignments")}>Back to Assignments</Button>
      </div>
    );
  }

  const submissions = assignment.submissions || [];
  const gradedCount = submissions.filter((s) => s.gradeStatus === "GRADED").length;
  const pendingCount = submissions.filter((s) => s.gradeStatus === "UNGRADED").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back & Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/teacher/assignments")} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">{assignment.subject || "Assignment"}</span>
              <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium">{assignment.type}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {assignment.status === "DRAFT" ? (
            <Button
              onClick={async () => {
                await assignmentApi.publish(assignment.id);
                fetchDetail();
              }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="h-4 w-4" />
              Publish Now
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Published
            </span>
          )}
        </div>
      </div>

      {/* Assignment Overview Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total Submissions</p>
          <p className="text-xl font-bold mt-1">{submissions.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Pending Review</p>
          <p className="text-xl font-bold text-amber-500 mt-1">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Graded</p>
          <p className="text-xl font-bold text-emerald-500 mt-1">{gradedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Maximum Marks</p>
          <p className="text-xl font-bold text-primary mt-1">{assignment.maxMarks}</p>
        </div>
      </div>

      {/* Instructions & Resources Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold border-b border-border pb-2">Instructions & Configuration</h3>
        <p className="text-sm text-foreground/90 whitespace-pre-line">{assignment.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border/50 text-xs">
          <div>
            <span className="font-semibold text-muted-foreground block">Due Date:</span>
            <span className="font-medium text-foreground">
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
            <span className="font-semibold text-muted-foreground block">Submission Format:</span>
            <span className="font-medium text-foreground">{assignment.submissionType}</span>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground block">XP Reward:</span>
            <span className="font-bold text-emerald-500">+{Number(assignment.xpReward)} XP</span>
          </div>
        </div>

        {/* Attached Learning Materials */}
        {assignment.materials && assignment.materials.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Learning Resources ({assignment.materials.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {assignment.materials.map((m) => (
                <a
                  key={m.id}
                  href={m.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  {m.title}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Student Submissions List Table */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Student Submissions
          </h2>
          <span className="text-xs text-muted-foreground">{submissions.length} total entries</span>
        </div>

        {submissions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium">No submissions received yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Attempt</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Submitted At</th>
                  <th className="py-3 px-3">Marks</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((sub) => {
                  const studentName = sub.student ? `${sub.student.firstName} ${sub.student.lastName}` : "Unknown Student";
                  const isGraded = sub.gradeStatus === "GRADED";
                  const isReturned = sub.gradeStatus === "RETURNED";

                  return (
                    <tr key={sub.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">{studentName}</div>
                        <div className="text-xs text-muted-foreground">{sub.student?.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-mono">Attempt {sub.attempt}</span>
                      </td>
                      <td className="py-3 px-3">
                        {sub.submissionStatus === "LATE" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-500">
                            LATE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                            ON TIME
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {new Date(sub.submittedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-3">
                        {isGraded ? (
                          <span className="font-bold text-emerald-500">
                            {sub.score} / {assignment.maxMarks}
                          </span>
                        ) : isReturned ? (
                          <span className="text-xs font-medium text-amber-500">Returned</span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">Ungraded</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openGradingModal(sub)} className="gap-1.5">
                          <FileCheck className="h-3.5 w-3.5" />
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
      </div>

      {/* Grading Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold">Grade Submission</h3>
                <p className="text-xs text-muted-foreground">
                  {gradingSubmission.student?.firstName} {gradingSubmission.student?.lastName} (Attempt #{gradingSubmission.attempt})
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setGradingSubmission(null)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Submission Content Review */}
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted Work</h4>
              {gradingSubmission.text && (
                <div className="rounded-lg bg-card p-3 text-sm whitespace-pre-line border border-border/60">
                  {gradingSubmission.text}
                </div>
              )}

              {gradingSubmission.externalUrl && (
                <div>
                  <a
                    href={gradingSubmission.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
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
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary"
                    >
                      <Download className="h-3.5 w-3.5 text-primary" />
                      {asset.filename || "Uploaded File"}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Rubric Evaluator */}
            {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rubric Evaluation</h4>
                <div className="space-y-2">
                  {assignment.rubric.map((r: RubricCriterion, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-3">
                      <div>
                        <div className="text-xs font-bold text-foreground">{r.criterion}</div>
                        {r.description && <div className="text-[11px] text-muted-foreground">{r.description}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={r.maxMarks}
                          value={rubricScores[idx] ?? r.maxMarks}
                          onChange={(e) => handleRubricScoreChange(idx, Number(e.target.value))}
                          className="w-16 rounded-md border border-border bg-card px-2 py-1 text-xs font-bold text-primary text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">/ {r.maxMarks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score & Notes Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Final Score (out of {assignment.maxMarks})
                </label>
                <input
                  type="number"
                  min={0}
                  max={assignment.maxMarks}
                  value={gradeScore}
                  onChange={(e) => setGradeScore(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Teacher Feedback / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide constructive feedback for the student..."
                  value={gradeNotes}
                  onChange={(e) => setGradeNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="returnResub"
                  checked={returnForResubmission}
                  onChange={(e) => setReturnForResubmission(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="returnResub" className="text-xs font-medium text-foreground">
                  Return to student for resubmission (Requires revision)
                </label>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setGradingSubmission(null)}>
                Cancel
              </Button>
              <Button
                disabled={gradingSubmitting}
                onClick={handleGradeSubmit}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Award className="h-4 w-4" />
                {gradingSubmitting ? "Saving Grade..." : "Submit Grade & Award XP"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
