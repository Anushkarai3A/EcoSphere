import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Link as LinkIcon, Plus, Save, Send, Trash2 } from "lucide-react";
import { assignmentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type {
  AssignmentType,
  CreateAssignmentInput,
  GradingType,
  QuestCategory,
  RubricCriterion,
  SubmissionType,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DisplayTitle, MetaRow, SectionHead } from "@/components/gallery";
import { cn } from "@/lib/utils";

const ASSIGNMENT_TYPES: { label: string; value: AssignmentType }[] = [
  { label: "Written Assignment", value: "WRITTEN" },
  { label: "Research Paper", value: "RESEARCH" },
  { label: "Environmental Activity", value: "ENVIRONMENTAL_ACTIVITY" },
  { label: "Project Work", value: "PROJECT" },
  { label: "Presentation", value: "PRESENTATION" },
  { label: "Report", value: "REPORT" },
  { label: "File Submission", value: "FILE_SUBMISSION" },
  { label: "Individual", value: "INDIVIDUAL" },
  { label: "Other", value: "OTHER" },
];

const SUBMISSION_TYPES: { label: string; value: SubmissionType; desc: string }[] = [
  { label: "Text Response", value: "TEXT", desc: "Rich text editor entry" },
  { label: "PDF Document", value: "PDF", desc: "Single or multi-page PDF upload" },
  { label: "Office Document", value: "DOCUMENT", desc: "DOCX, PPTX, or PDF files" },
  { label: "Presentation", value: "PRESENTATION", desc: "Slide decks (PPT, PDF)" },
  { label: "Images", value: "IMAGE", desc: "Photo proof / diagram uploads" },
  { label: "Video Upload / Link", value: "VIDEO", desc: "Video file or external video URL" },
  { label: "Multiple Files", value: "MULTIPLE_FILES", desc: "ZIP, PDF, DOCX, images combined" },
  { label: "External URL", value: "URL", desc: "Web link or drive URL" },
  { label: "Text & File Combined", value: "TEXT_AND_FILE", desc: "Written reflection + file attachments" },
];

const CATEGORIES: { label: string; value: QuestCategory }[] = [
  { label: "Waste Management", value: "WASTE_COLLECTION" },
  { label: "Recycling & Upcycling", value: "RECYCLING" },
  { label: "Tree Plantation & Flora", value: "TREE_PLANTATION" },
  { label: "Park & Nature Cleaning", value: "PARK_CLEANING" },
  { label: "Biodiversity & Wildlife", value: "BIODIVERSITY" },
  { label: "Awareness & Education", value: "AWARENESS" },
  { label: "Other Environmental", value: "OTHER" },
];

const fieldClass =
  "w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35";

export function CreateAssignmentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolName = user?.school?.name || "Your Institution";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("Environmental Science");
  const [topic, setTopic] = useState<QuestCategory>("WASTE_COLLECTION");
  const [type, setType] = useState<AssignmentType>("WRITTEN");

  // Assign To
  const [targetType, setTargetType] = useState<"CLASS" | "STUDENTS">("CLASS");

  // Schedule
  const nowStr = new Date().toISOString().slice(0, 16);
  const tomorrowStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [startAt, setStartAt] = useState(nowStr);
  const [dueAt, setDueAt] = useState(tomorrowStr);
  const [allowLate, setAllowLate] = useState(true);
  const [lateDeadline, setLateDeadline] = useState("");

  // Submission Config
  const [submissionType, setSubmissionType] = useState<SubmissionType>("TEXT_AND_FILE");
  const [allowedFormatsStr, setAllowedFormatsStr] = useState("pdf, docx, txt, png, jpg");
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(10);
  const [maxFiles, setMaxFiles] = useState(3);

  // Evaluation
  const [maxMarks, setMaxMarks] = useState(100);
  const [passMarks, setPassMarks] = useState(40);
  const [gradingType, setGradingType] = useState<GradingType>("MARKS");
  const [allowResubmission] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [teacherFeedbackEnabled] = useState(true);

  // Rubric
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([
    { criterion: "Research & Content Quality", maxMarks: 40, description: "Depth of environmental research and facts" },
    { criterion: "Critical Understanding", maxMarks: 40, description: "Analysis of environmental impact" },
    { criterion: "Presentation & Formatting", maxMarks: 20, description: "Clarity, structure, and references" },
  ]);

  // Gamification
  const [xpReward, setXpReward] = useState(50);
  const [category, setCategory] = useState("Waste Management");

  // Materials & Attachments
  const [externalUrlInput, setExternalUrlInput] = useState("");
  const [externalUrls, setExternalUrls] = useState<string[]>([]);
  const [attachedFiles] = useState<File[]>([]);

  const addRubricRow = () => {
    setRubricCriteria([...rubricCriteria, { criterion: "", maxMarks: 10, description: "" } as RubricCriterion]);
  };

  const removeRubricRow = (index: number) => {
    setRubricCriteria(rubricCriteria.filter((_, i) => i !== index));
  };

  const updateRubricRow = (index: number, field: keyof RubricCriterion, value: string | number) => {
    const updated = [...rubricCriteria];
    updated[index] = { ...updated[index], [field]: value } as RubricCriterion;
    setRubricCriteria(updated);
  };

  const totalRubricMarks = rubricCriteria.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);

  const addExternalLink = () => {
    if (!externalUrlInput.trim()) return;
    setExternalUrls([...externalUrls, externalUrlInput.trim()]);
    setExternalUrlInput("");
  };

  const handleSubmit = async (publish: boolean) => {
    setError(null);
    if (!title.trim()) {
      setError("Assignment title is required");
      return;
    }
    if (!description.trim()) {
      setError("Instructions / Description is required");
      return;
    }
    if (new Date(dueAt).getTime() <= new Date(startAt).getTime()) {
      setError("Due Date & Time must be set after Start Date & Time");
      return;
    }

    setSaving(true);
    try {
      const allowedFormats = allowedFormatsStr
        .split(",")
        .map((s) => s.trim().toLowerCase().replace(".", ""))
        .filter((s) => s.length > 0);

      const input: CreateAssignmentInput = {
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        type,
        topic,
        xpReward,
        startAt: new Date(startAt).toISOString(),
        dueAt: new Date(dueAt).toISOString(),
        allowLate,
        lateDeadline: lateDeadline ? new Date(lateDeadline).toISOString() : undefined,
        submissionType,
        allowedFormats,
        maxFileSizeMb,
        maxFiles,
        maxMarks,
        passMarks,
        gradingType,
        allowResubmission,
        maxAttempts,
        teacherFeedbackEnabled,
        rubric: rubricCriteria.filter((c) => c.criterion.trim().length > 0),
        category,
        targetType,
        publish,
      };

      const res = await assignmentApi.create(input);
      const assignmentId = res.assignment.id;

      // Attach learning materials if provided
      if (attachedFiles.length > 0 || externalUrls.length > 0) {
        for (const url of externalUrls) {
          await assignmentApi.addMaterial(assignmentId, [], "Reference Link", undefined, url);
        }
        if (attachedFiles.length > 0) {
          await assignmentApi.addMaterial(assignmentId, attachedFiles, "Attached Study Material");
        }
      }

      navigate(`/app/teacher/assignments/${assignmentId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 pb-16 sm:px-10">
      {/* Hero */}
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
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
            <span>Teacher workspace</span>
            <span>{schoolName}</span>
          </MetaRow>
        </div>
        <DisplayTitle lines={["CREATE", "ASSIGNMENT"]} />
        <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
          Configure basic info, schedule, submission rules, rubric, and rewards.
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive"
        >
          {error}
        </p>
      )}

      {/* 1. BASIC INFORMATION */}
      <section className="glass-panel flex flex-col gap-5 rounded-[10px] p-5 sm:p-6">
        <SectionHead kicker="Section 01" title="Basic information" />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ca-title">Assignment Title *</Label>
            <Input
              id="ca-title"
              type="text"
              placeholder="e.g. Plastic Pollution & Ocean Conservation Case Study"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-desc">Description / Instructions *</Label>
            <textarea
              id="ca-desc"
              rows={4}
              placeholder="Detail the objectives, requirements, formatting rules, and expected outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(fieldClass, "resize-y")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ca-subject">Subject / Course</Label>
              <Input id="ca-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ca-topic">Topic Category</Label>
              <select
                id="ca-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value as QuestCategory)}
                className={cn(fieldClass, "h-10")}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ca-type">Assignment Type</Label>
              <select
                id="ca-type"
                value={type}
                onChange={(e) => setType(e.target.value as AssignmentType)}
                className={cn(fieldClass, "h-10")}
              >
                {ASSIGNMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ASSIGN TO */}
      <section className="glass-panel flex flex-col gap-5 rounded-[10px] p-5 sm:p-6">
        <SectionHead kicker="Section 02" title="Assign to" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ca-institution">Institution (Read-Only)</Label>
            <Input
              id="ca-institution"
              type="text"
              readOnly
              value={schoolName}
              className="cursor-not-allowed bg-white/[0.06] text-ash"
            />
            <p className="font-micro text-[10px] uppercase text-ash">Bound to your verified institution session.</p>
          </div>

          <div className="space-y-2">
            <Label>Recipient Scope</Label>
            <div className="inline-flex w-full flex-wrap gap-1 rounded-full border border-frost/20 bg-deep/60 p-1">
              <button
                type="button"
                onClick={() => setTargetType("CLASS")}
                className={cn(
                  "flex-1 rounded-full px-3.5 py-2 font-micro text-[10px] uppercase tracking-[0.06em] transition-colors",
                  targetType === "CLASS"
                    ? "bg-emerald/15 text-emerald shadow-[inset_0_0_0_1px_rgba(46,207,143,0.45)]"
                    : "text-ash hover:text-bone",
                )}
              >
                Entire Enrolled Class
              </button>
              <button
                type="button"
                onClick={() => setTargetType("STUDENTS")}
                className={cn(
                  "flex-1 rounded-full px-3.5 py-2 font-micro text-[10px] uppercase tracking-[0.06em] transition-colors",
                  targetType === "STUDENTS"
                    ? "bg-emerald/15 text-emerald shadow-[inset_0_0_0_1px_rgba(46,207,143,0.45)]"
                    : "text-ash hover:text-bone",
                )}
              >
                Specific Students
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SCHEDULE */}
      <section className="glass-panel flex flex-col gap-5 rounded-[10px] p-5 sm:p-6">
        <SectionHead kicker="Section 03" title="Schedule & deadlines" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ca-start">Start Date & Time</Label>
            <Input id="ca-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-due">Due Date & Time *</Label>
            <Input id="ca-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-frost/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allowLate"
              checked={allowLate}
              onChange={(e) => setAllowLate(e.target.checked)}
              className="h-4 w-4 rounded-[2px] border-frost/40 accent-emerald"
            />
            <label htmlFor="allowLate" className="font-micro text-[11px] uppercase text-bone">
              Allow Late Submissions (Marked as LATE)
            </label>
          </div>

          {allowLate && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-micro text-[10px] uppercase text-ash">Late Deadline:</span>
              <Input
                type="datetime-local"
                value={lateDeadline}
                onChange={(e) => setLateDeadline(e.target.value)}
                className="w-auto"
              />
            </div>
          )}
        </div>
      </section>

      {/* 4. SUBMISSION TYPE */}
      <section className="glass-panel flex flex-col gap-5 rounded-[10px] p-5 sm:p-6">
        <SectionHead kicker="Section 04" title="Submission format & limits" />
        <div>
          <Label className="mb-3 block">Allowed Submission Type</Label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {SUBMISSION_TYPES.map((st) => (
              <button
                key={st.value}
                type="button"
                aria-pressed={submissionType === st.value}
                onClick={() => setSubmissionType(st.value)}
                className={cn(
                  "flex flex-col gap-1 rounded-[10px] border p-3.5 text-left transition-all",
                  submissionType === st.value
                    ? "border-cyan/70 bg-cyan/10 shadow-[0_0_24px_-14px_rgba(34,211,238,0.9)]"
                    : "border-frost/25 bg-white/[0.03] hover:border-frost/60",
                )}
              >
                <span className="font-micro text-[11px] uppercase text-bone">{st.label}</span>
                <span className="font-micro text-[10px] leading-[1.5] text-ash">{st.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-frost/15 pt-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ca-formats">Allowed Extensions (comma separated)</Label>
            <Input
              id="ca-formats"
              type="text"
              value={allowedFormatsStr}
              onChange={(e) => setAllowedFormatsStr(e.target.value)}
              placeholder="pdf, docx, txt"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-maxsize">Max File Size (MB)</Label>
            <Input
              id="ca-maxsize"
              type="number"
              min={1}
              max={500}
              value={maxFileSizeMb}
              onChange={(e) => setMaxFileSizeMb(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-maxfiles">Max Files Allowed</Label>
            <Input
              id="ca-maxfiles"
              type="number"
              min={1}
              max={20}
              value={maxFiles}
              onChange={(e) => setMaxFiles(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* 5. EVALUATION & RUBRIC */}
      <section className="glass-panel flex flex-col gap-5 rounded-[10px] p-5 sm:p-6">
        <SectionHead kicker="Section 05" title="Evaluation & rubric" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="ca-maxmarks">Maximum Marks *</Label>
            <Input
              id="ca-maxmarks"
              type="number"
              min={1}
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-passmarks">Passing Marks</Label>
            <Input
              id="ca-passmarks"
              type="number"
              min={0}
              value={passMarks}
              onChange={(e) => setPassMarks(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-grading">Grading Type</Label>
            <select
              id="ca-grading"
              value={gradingType}
              onChange={(e) => setGradingType(e.target.value as GradingType)}
              className={cn(fieldClass, "h-10")}
            >
              <option value="MARKS">Marks (e.g. 85/100)</option>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="PASS_FAIL">Pass / Fail</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-attempts">Max Attempts</Label>
            <Input
              id="ca-attempts"
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Rubric Builder */}
        <div className="space-y-3 border-t border-frost/15 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-[22px] font-medium leading-tight text-bone">Evaluation Rubric</h3>
              <p className="mt-1 font-micro text-[10px] uppercase text-ash">
                Total rubric marks{" "}
                <span className="font-title text-[14px] font-semibold tracking-normal text-gold">{totalRubricMarks}</span>{" "}
                / {maxMarks}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRubricRow} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add Criterion
            </Button>
          </div>

          <div className="space-y-2">
            {rubricCriteria.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-[10px] border border-frost/20 bg-white/[0.03] p-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="text"
                      placeholder="Criterion Name (e.g. Research Depth)"
                      value={c.criterion}
                      onChange={(e) => updateRubricRow(i, "criterion", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Marks"
                      value={c.maxMarks}
                      onChange={(e) => updateRubricRow(i, "maxMarks", Number(e.target.value))}
                      className="w-full shrink-0 sm:w-24"
                    />
                  </div>
                  <Input
                    type="text"
                    placeholder="Description / Requirements for full marks..."
                    value={c.description || ""}
                    onChange={(e) => updateRubricRow(i, "description", e.target.value)}
                    className="text-ash"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRubricRow(i)}
                  className="mt-1 h-8 w-8 text-ash hover:text-destructive"
                  aria-label="Remove criterion"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. GAMIFICATION */}
      <section className="glass-panel flex flex-col gap-5 rounded-[10px] p-5 sm:p-6">
        <SectionHead kicker="Section 06" title="Gamification & XP reward" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ca-xp">XP Reward *</Label>
            <div className="relative">
              <Input
                id="ca-xp"
                type="number"
                min={0}
                max={10000}
                value={xpReward}
                onChange={(e) => setXpReward(Number(e.target.value))}
                className="pr-14"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-title text-[13px] font-semibold text-gold">
                XP
              </span>
            </div>
            <p className="font-micro text-[10px] uppercase leading-[1.6] text-ash">
              Awarded once upon passing grade. Idempotency guarantees no duplicate XP on resubmissions.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-category">Environmental Category</Label>
            <Input
              id="ca-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Waste Management, Climate Action"
            />
          </div>
        </div>
      </section>

      {/* 7. LEARNING RESOURCES */}
      <section className="glass-panel flex flex-col gap-5 rounded-[10px] p-5 sm:p-6">
        <SectionHead kicker="Section 07" title="Attach learning resources" />
        <div className="space-y-2">
          <Label htmlFor="ca-link">Add External Reference Links / Videos</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="ca-link"
              type="url"
              placeholder="https://..."
              value={externalUrlInput}
              onChange={(e) => setExternalUrlInput(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={addExternalLink} className="gap-1 sm:self-start">
              <LinkIcon className="h-3.5 w-3.5" aria-hidden />
              Add Link
            </Button>
          </div>

          {externalUrls.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {externalUrls.map((url, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-full border border-frost/30 bg-white/[0.06] px-2.5 py-1 font-micro text-[10px] uppercase text-bone"
                >
                  <LinkIcon className="h-3 w-3" aria-hidden />
                  <span className="max-w-[240px] truncate">{url}</span>
                  <button
                    type="button"
                    onClick={() => setExternalUrls(externalUrls.filter((_, i) => i !== idx))}
                    className="ml-1 text-ash transition-colors hover:text-destructive"
                    aria-label="Remove link"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="font-micro text-[10px] uppercase text-ash">No reference links attached yet.</p>
          )}
        </div>
      </section>

      {/* 8. PUBLICATION & ACTIONS */}
      <div className="glass-panel flex flex-col-reverse items-stretch gap-3 rounded-[10px] p-5 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" disabled={saving} onClick={() => handleSubmit(false)} className="gap-2">
          <Save className="h-4 w-4" aria-hidden />
          Save as Draft
        </Button>

        <Button type="button" disabled={saving} onClick={() => handleSubmit(true)} className="gap-2">
          <Send className="h-4 w-4" aria-hidden />
          {saving ? "Publishing..." : "Publish Assignment"}
        </Button>
      </div>
    </div>
  );
}
