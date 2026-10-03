import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  History,
  Paperclip,
  RefreshCw,
  Send,
  Upload,
  X,
} from "lucide-react";
import { assignmentApi } from "@/lib/api";
import type { Assignment, AssignmentSubmission, RubricCriterion } from "@/lib/types";
import { Button } from "@/components/ui/button";

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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium">Loading assignment details...</p>
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

  const subType = assignment.submissionType;
  const showTextEditor = subType === "TEXT" || subType === "TEXT_AND_FILE";
  const showUrlInput = subType === "URL";
  const showFileUpload = subType !== "TEXT" && subType !== "URL";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/student/assignments")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">{assignment.subject || "Coursework"}</span>
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium">{assignment.type}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Due Date</p>
          <p className="text-sm font-bold mt-1 text-foreground">{dueFormatted}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Maximum Marks</p>
          <p className="text-sm font-bold mt-1 text-primary">{assignment.maxMarks}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">XP Reward</p>
          <p className="text-sm font-bold mt-1 text-emerald-500">+{Number(assignment.xpReward)} XP</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Attempts Allowed</p>
          <p className="text-sm font-bold mt-1 text-foreground">
            {attemptCount} / {assignment.maxAttempts}
          </p>
        </div>
      </div>

      {/* Instructions & Resources */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">Instructions & Background</h2>
        <p className="text-sm text-foreground/90 whitespace-pre-line">{assignment.description}</p>

        {/* Attached Learning Materials */}
        {assignment.materials && assignment.materials.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Teacher Resources ({assignment.materials.length})
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

        {/* Evaluation Rubric */}
        {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
          <div className="pt-3 border-t border-border/50 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evaluation Rubric</h4>
            <div className="space-y-1.5">
              {assignment.rubric.map((r: RubricCriterion, idx: number) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5 text-xs">
                  <div>
                    <span className="font-bold text-foreground">{r.criterion}</span>
                    {r.description && <span className="text-muted-foreground ml-2">— {r.description}</span>}
                  </div>
                  <span className="font-bold text-primary whitespace-nowrap">{r.maxMarks} marks</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submission Form Section */}
      {(!mySubmission || canResubmit) && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              {mySubmission ? `Submit Revision (Attempt #${attemptCount + 1})` : "Submit Assignment"}
            </h2>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{assignment.submissionType}</span>
          </div>

          {submitError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
              {submitError}
            </div>
          )}

          {/* Text Editor */}
          {showTextEditor && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Written Answer / Reflection *
              </label>
              <textarea
                rows={6}
                placeholder="Type your response, reflection, or essay here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* URL Input */}
          {showUrlInput && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                External Resource URL *
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* File Upload Zone */}
          {showFileUpload && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Attach Files (Max {assignment.maxFiles} files, up to {assignment.maxFileSizeMb}MB each)
              </label>

              <div className="relative rounded-xl border border-dashed border-border bg-background/50 p-6 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-xs font-medium text-foreground">
                  Click or drag files here to upload
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
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
                <div className="space-y-1.5">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground">{file.name}</span>
                        <span className="text-muted-foreground">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div className="flex justify-end pt-3 border-t border-border">
            <Button
              disabled={submitting}
              onClick={handleSubmitWork}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting Work..." : "Submit Work"}
            </Button>
          </div>
        </div>
      )}

      {/* Submission & Attempt History */}
      {allSubmissions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Submission & Attempt History
            </h2>
            <span className="text-xs text-muted-foreground">{allSubmissions.length} attempt(s) recorded</span>
          </div>

          <div className="space-y-4">
            {allSubmissions.map((sub) => {
              const isGraded = sub.gradeStatus === "GRADED";
              const isReturned = sub.gradeStatus === "RETURNED";

              return (
                <div key={sub.id} className="rounded-xl border border-border bg-background p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">Attempt #{sub.attempt}</span>
                      {sub.submissionStatus === "LATE" ? (
                        <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-500">LATE</span>
                      ) : (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">ON TIME</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Submitted: {new Date(sub.submittedAt).toLocaleString()}
                    </span>
                  </div>

                  {sub.text && (
                    <div className="rounded-lg bg-card p-3 text-xs whitespace-pre-line border border-border/60">
                      {sub.text}
                    </div>
                  )}

                  {sub.externalUrl && (
                    <a
                      href={sub.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
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
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:border-primary"
                        >
                          <Download className="h-3.5 w-3.5 text-primary" />
                          {asset.filename || "Uploaded File"}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Teacher Feedback Panel */}
                  {isGraded && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                        <span>Teacher Grade:</span>
                        <span>
                          {sub.score} / {assignment.maxMarks}
                        </span>
                      </div>
                      {sub.gradeNotes && (
                        <p className="text-muted-foreground pt-1 border-t border-emerald-500/20">{sub.gradeNotes}</p>
                      )}
                    </div>
                  )}

                  {isReturned && (
                    <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 space-y-1 text-xs">
                      <div className="font-bold text-purple-600 dark:text-purple-400">Returned for Revision</div>
                      {sub.gradeNotes && <p className="text-muted-foreground">{sub.gradeNotes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
