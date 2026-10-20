import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Paperclip,
  RefreshCw,
  Send,
  Upload,
  X,
} from "lucide-react";
import { assignmentApi } from "@/lib/api";
import type { Assignment, AssignmentSubmission, RubricCriterion, StudentAssignmentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";

export function StudentAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await assignmentApi.studentGet(id);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArr]);
    }
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== idx));
  };

  const handleSubmitWork = async () => {
    if (!id || !assignment) return;
    setSubmitError(null);

    // Basic Validation
    const subType = assignment.submissionType;
    const requiresText = subType === "TEXT" || subType === "TEXT_AND_FILE";
    const requiresUrl = subType === "URL";
    const requiresFiles = subType === "PDF" || subType === "DOCUMENT" || subType === "IMAGE" || subType === "VIDEO" || subType === "MULTIPLE_FILES";

    if (requiresText && !textInput.trim()) {
      setSubmitError("Please provide a written response before submitting.");
      return;
    }
    if (requiresUrl && !urlInput.trim()) {
      setSubmitError("Please provide a valid URL.");
      return;
    }
    if (requiresFiles && selectedFiles.length === 0) {
      setSubmitError("Please attach at least one file for submission.");
      return;
    }

    setSubmitting(true);
    try {
      await assignmentApi.studentSubmit(id, selectedFiles, {
        text: textInput.trim() || undefined,
        externalUrl: urlInput.trim() || undefined,
      });

      // Clear Form & Refresh
      setTextInput("");
      setUrlInput("");
      setSelectedFiles([]);
      fetchDetail();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <RefreshCw className="h-7 w-7 animate-spin text-cyan" aria-hidden />
        <p className="font-micro text-[11px] uppercase text-ash">Loading assignment details...</p>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
        <p className="font-micro text-[11px] uppercase text-destructive">{error || "Assignment not found"}</p>
        <Button onClick={() => navigate("/app/student/assignments")}>Back to My Assignments</Button>
      </div>
    );
  }

  const mySubmission = assignment.mySubmission;
  const allSubmissions = (assignment as unknown as { allSubmissions?: AssignmentSubmission[] }).allSubmissions || (mySubmission ? [mySubmission] : []);
  const attemptCount = allSubmissions.length;
  const canResubmit = assignment.allowResubmission && attemptCount < assignment.maxAttempts;

  const dueFormatted = new Date(assignment.dueAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusKey: StudentAssignmentStatus = mySubmission?.gradeStatus === "GRADED"
    ? "GRADED"
    : mySubmission?.gradeStatus === "RETURNED"
      ? "RETURNED"
      : mySubmission
        ? mySubmission.submissionStatus === "LATE"
          ? "LATE"
          : "SUBMITTED"
        : assignment.calculatedStatus ?? "NOT_STARTED";

  const subType = assignment.submissionType;
  const showTextEditor = subType === "TEXT" || subType === "TEXT_AND_FILE";
  const showUrlInput = subType === "URL";
  const showFileUpload = subType !== "TEXT" && subType !== "URL";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-16 px-5 pb-16 sm:px-10">
      {/* Hero */}
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/student/assignments")}
            className="h-9 w-9"
            aria-label="Back to my assignments"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <MetaRow>
            <span>{assignment.subject || "Coursework"}</span>
            <span className="rounded-[4px] border border-frost/40 bg-deep px-2 py-0.5 font-micro text-[10px] uppercase tracking-[0.08em] text-bone">
              {assignment.type}
            </span>
            <StatusChip status={statusKey} />
          </MetaRow>
        </div>
        <DisplayTitle lines={[assignment.title.toUpperCase()]} />
        <MetaRow>
          <span className="text-cyan">Due {dueFormatted}</span>
          <span>{assignment.maxMarks} marks</span>
          <span className="font-title text-[15px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
            +{Number(assignment.xpReward)} XP
          </span>
        </MetaRow>
      </section>

      <Rule />

      {/* Overview */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Overview" title="At a glance" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="glass-panel rounded-[10px] p-4">
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-ash">Due Date</p>
            <p className="mt-2 font-micro text-[13px] leading-snug text-bone">{dueFormatted}</p>
          </div>
          <div className="glass-panel rounded-[10px] p-4">
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-ash">Maximum Marks</p>
            <p className="mt-2 font-title text-[28px] font-semibold leading-none text-bone">{assignment.maxMarks}</p>
          </div>
          <div className="glass-panel rounded-[10px] p-4">
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-ash">XP Reward</p>
            <p className="mt-2 font-title text-[28px] font-semibold leading-none text-gold text-glow-gold">
              +{Number(assignment.xpReward)} XP
            </p>
          </div>
          <div className="glass-panel rounded-[10px] p-4">
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-ash">Attempts Allowed</p>
            <p className="mt-2 font-title text-[28px] font-semibold leading-none text-bone">
              {attemptCount} / {assignment.maxAttempts}
            </p>
          </div>
        </div>
      </section>

      <Rule />

      {/* Instructions & Resources */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Brief" title="Instructions & background" />
        <p className="max-w-3xl whitespace-pre-line text-sm text-ash">{assignment.description}</p>

        {/* Attached Learning Materials */}
        {assignment.materials && assignment.materials.length > 0 && (
          <div className="border-t border-frost/15 pt-3">
            <h4 className="mb-2 font-micro text-[10px] uppercase tracking-[0.14em] text-ash">
              Teacher Resources ({assignment.materials.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {assignment.materials.map((m) => (
                <a
                  key={m.id}
                  href={m.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-frost/40 bg-deep px-2.5 py-1 font-micro text-[10px] uppercase tracking-[0.06em] text-bone transition-colors hover:border-cyan/60 hover:text-cyan"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  {m.title}
                  <ExternalLink className="h-3 w-3 text-ash" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Evaluation Rubric */}
        {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
          <div className="border-t border-frost/15 pt-3">
            <h4 className="mb-2 font-micro text-[10px] uppercase tracking-[0.14em] text-ash">Evaluation Rubric</h4>
            <div className="flex flex-col">
              {assignment.rubric.map((r: RubricCriterion, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 border-t border-frost/15 py-3 last:border-b"
                >
                  <div>
                    <span className="text-xs text-bone">{r.criterion}</span>
                    {r.description && <span className="ml-2 text-xs text-ash">— {r.description}</span>}
                  </div>
                  <span className="whitespace-nowrap font-title text-[15px] font-semibold leading-none text-bone">
                    {r.maxMarks} marks
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Submission Form Section */}
      {(!mySubmission || canResubmit) && (
        <>
          <Rule />
          <section className="flex flex-col gap-5">
            <SectionHead
              kicker="Submission"
              title={mySubmission ? `Submit Revision (Attempt #${attemptCount + 1})` : "Submit Assignment"}
              right={<span className="font-micro text-[10px] uppercase text-ash">{assignment.submissionType}</span>}
            />

            {submitError && (
              <div className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
                {submitError}
              </div>
            )}

            {/* Text Editor */}
            {showTextEditor && (
              <div>
                <label className="mb-1.5 block font-micro text-[10px] uppercase tracking-[0.14em] text-ash">
                  Written Answer / Reflection *
                </label>
                <textarea
                  rows={6}
                  placeholder="Type your response, reflection, or essay here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 focus:border-cyan/70 focus:outline-none focus:ring-2 focus:ring-cyan/35"
                />
              </div>
            )}

            {/* URL Input */}
            {showUrlInput && (
              <div>
                <label className="mb-1.5 block font-micro text-[10px] uppercase tracking-[0.14em] text-ash">
                  External Resource URL *
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 focus:border-cyan/70 focus:outline-none focus:ring-2 focus:ring-cyan/35"
                />
              </div>
            )}

            {/* File Upload Zone */}
            {showFileUpload && (
              <div className="flex flex-col gap-3">
                <label className="block font-micro text-[10px] uppercase tracking-[0.14em] text-ash">
                  Attach Files (Max {assignment.maxFiles} files, up to {assignment.maxFileSizeMb}MB each)
                </label>

                <div className="relative rounded-[10px] border border-dashed border-frost/40 bg-deep/50 p-6 text-center transition-colors hover:border-cyan/60">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-ash" aria-hidden />
                  <p className="font-micro text-[11px] uppercase text-bone">
                    Click or drag files here to upload
                  </p>
                  <p className="mt-1 font-micro text-[10px] text-ash">
                    Allowed formats: {assignment.allowedFormats ? assignment.allowedFormats.join(", ") : "PDF, DOCX, PNG, JPG, ZIP"}
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="flex flex-col">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between border-t border-frost/15 py-3 last:border-b">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-cyan" aria-hidden />
                          <span className="text-xs text-bone">{file.name}</span>
                          <span className="font-micro text-[10px] uppercase text-ash">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="p-1 text-ash hover:text-destructive"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Submit Action */}
            <div className="flex justify-end border-t border-frost/15 pt-3">
              <Button
                disabled={submitting}
                onClick={handleSubmitWork}
                className="gap-2"
              >
                <Send className="h-4 w-4" aria-hidden />
                {submitting ? "Submitting Work..." : "Submit Work"}
              </Button>
            </div>
          </section>
        </>
      )}

      {/* Submission & Attempt History */}
      {allSubmissions.length > 0 && (
        <>
          <Rule />
          <section className="flex flex-col gap-5">
            <SectionHead
              kicker="History"
              title="Submission & Attempt History"
              right={
                <span className="font-micro text-[10px] uppercase text-ash">
                  {allSubmissions.length} attempt(s) recorded
                </span>
              }
            />

            <div className="flex flex-col">
              {allSubmissions.map((sub) => {
                const isGraded = sub.gradeStatus === "GRADED";
                const isReturned = sub.gradeStatus === "RETURNED";

                return (
                  <div key={sub.id} className="flex flex-col gap-3 border-t border-frost/15 py-4 last:border-b">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-frost/15 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-title text-[22px] font-semibold leading-none text-bone">
                          Attempt #{sub.attempt}
                        </span>
                        {sub.submissionStatus === "LATE" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-frost/30 bg-white/[0.03] px-2 py-0.5 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">
                            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ash" />
                            Late
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-emerald/50 bg-emerald/10 px-2 py-0.5 font-micro text-[10px] uppercase tracking-[0.08em] text-emerald">
                            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_8px_rgba(46,207,143,0.9)]" />
                            On time
                          </span>
                        )}
                      </div>
                      <span className="font-micro text-[10px] uppercase text-ash">
                        Submitted: {new Date(sub.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    {sub.text && (
                      <div className="whitespace-pre-line rounded-[10px] border border-frost/25 bg-deep/60 p-3 text-xs text-bone">
                        {sub.text}
                      </div>
                    )}

                    {sub.externalUrl && (
                      <a
                        href={sub.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-micro text-[11px] text-cyan hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        {sub.externalUrl}
                      </a>
                    )}

                    {sub.assets && sub.assets.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {sub.assets.map((asset) => (
                          <a
                            key={asset.id}
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-[6px] border border-frost/40 bg-deep px-2.5 py-1 font-micro text-[10px] uppercase tracking-[0.06em] text-bone transition-colors hover:border-cyan/60 hover:text-cyan"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            {asset.filename || "Uploaded File"}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Teacher Feedback Panel */}
                    {isGraded && (
                      <div className="glass-panel space-y-1 rounded-[10px] p-4 text-xs">
                        <div className="flex items-center justify-between font-normal text-bone">
                          <span className="font-micro text-[10px] uppercase tracking-[0.14em] text-ash">Teacher Grade</span>
                          <span className="font-title text-[20px] font-semibold leading-none text-gold text-glow-gold">
                            {sub.score} / {assignment.maxMarks}
                          </span>
                        </div>
                        {Number(sub.xpAwarded) > 0 && (
                          <div className="flex items-center justify-between font-normal">
                            <span className="font-micro text-[10px] uppercase tracking-[0.14em] text-ash">XP Awarded</span>
                            <span className="font-title text-[15px] font-semibold leading-none text-gold">
                              +{Number(sub.xpAwarded)} XP
                            </span>
                          </div>
                        )}
                        {sub.gradeNotes && (
                          <p className="border-t border-frost/20 pt-2 text-ash">{sub.gradeNotes}</p>
                        )}
                      </div>
                    )}

                    {isReturned && (
                      <div className="space-y-1 rounded-[10px] border border-destructive/40 bg-destructive/10 p-4 text-xs">
                        <div className="font-normal text-destructive">Returned for Revision</div>
                        {sub.gradeNotes && <p className="text-ash">{sub.gradeNotes}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** Mission-briefing status chip — token colors only, labels unchanged. */
function StatusChip({ status }: { status: StudentAssignmentStatus }) {
  const base = "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 font-micro text-[10px] uppercase tracking-[0.08em]";
  const dot = "inline-block h-1.5 w-1.5 rounded-full";

  switch (status) {
    case "GRADED":
      return (
        <span className={`${base} border-gold/50 bg-gold/10 text-gold`}>
          <span aria-hidden className={`${dot} bg-gold shadow-[0_0_8px_rgba(242,181,68,0.9)]`} />
          Graded
        </span>
      );
    case "SUBMITTED":
      return (
        <span className={`${base} border-emerald/50 bg-emerald/10 text-emerald`}>
          <span aria-hidden className={`${dot} bg-emerald shadow-[0_0_8px_rgba(46,207,143,0.9)]`} />
          Submitted
        </span>
      );
    case "LATE":
      return (
        <span className={`${base} border-frost/30 bg-white/[0.03] text-ash`}>
          <span aria-hidden className={`${dot} bg-ash`} />
          Submitted late
        </span>
      );
    case "RETURNED":
      return (
        <span className={`${base} border-destructive/50 bg-destructive/10 text-destructive`}>
          <span aria-hidden className={`${dot} bg-destructive`} />
          Resubmission needed
        </span>
      );
    case "OVERDUE":
      return (
        <span className={`${base} border-destructive/50 bg-destructive/10 text-destructive`}>
          <span aria-hidden className={`${dot} bg-destructive shadow-[0_0_8px_rgba(239,143,146,0.9)]`} />
          Overdue
        </span>
      );
    default:
      return (
        <span className={`${base} border-frost/30 bg-white/[0.03] text-ash`}>
          <span aria-hidden className={`${dot} bg-ash`} />
          Not started
        </span>
      );
  }
}
