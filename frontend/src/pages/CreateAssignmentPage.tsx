import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  FileCheck,
  FileText,
  FolderPlus,
  Link as LinkIcon,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";
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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/teacher/assignments")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Assignment</h1>
          <p className="text-sm text-muted-foreground">Configure basic info, schedule, submission rules, rubric, and rewards.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {error}
        </div>
      )}

      {/* 1. BASIC INFORMATION */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">1. Basic Information</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Assignment Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Plastic Pollution & Ocean Conservation Case Study"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Description / Instructions *
            </label>
            <textarea
              rows={4}
              placeholder="Detail the objectives, requirements, formatting rules, and expected outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Subject / Course
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Topic Category
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as QuestCategory)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Assignment Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AssignmentType)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
      </div>

      {/* 2. ASSIGN TO */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">2. Assign To</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Institution (Read-Only)
            </label>
            <input
              type="text"
              readOnly
              value={schoolName}
              className="w-full rounded-lg border border-border/80 bg-accent/40 px-3.5 py-2 text-sm font-medium text-foreground cursor-not-allowed"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Bound to your verified institution session.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Recipient Scope
            </label>
            <div className="flex rounded-lg border border-border bg-background p-1 gap-1">
              <button
                type="button"
                onClick={() => setTargetType("CLASS")}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  targetType === "CLASS" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                Entire Enrolled Class
              </button>
              <button
                type="button"
                onClick={() => setTargetType("STUDENTS")}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  targetType === "STUDENTS" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                Specific Students
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SCHEDULE */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">3. Schedule & Deadlines</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Due Date & Time *
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allowLate"
              checked={allowLate}
              onChange={(e) => setAllowLate(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="allowLate" className="text-sm font-medium">
              Allow Late Submissions (Marked as LATE)
            </label>
          </div>

          {allowLate && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Late Deadline:</span>
              <input
                type="datetime-local"
                value={lateDeadline}
                onChange={(e) => setLateDeadline(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. SUBMISSION TYPE */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <FileCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">4. Submission Format & Limits</h2>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Allowed Submission Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SUBMISSION_TYPES.map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => setSubmissionType(st.value)}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                  submissionType === st.value
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <span className="text-xs font-bold">{st.label}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">{st.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Allowed Extensions (comma separated)
            </label>
            <input
              type="text"
              value={allowedFormatsStr}
              onChange={(e) => setAllowedFormatsStr(e.target.value)}
              placeholder="pdf, docx, txt"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Max File Size (MB)
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={maxFileSizeMb}
              onChange={(e) => setMaxFileSizeMb(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Max Files Allowed
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxFiles}
              onChange={(e) => setMaxFiles(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 5. EVALUATION & RUBRIC */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">5. Evaluation & Rubric</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Maximum Marks *
            </label>
            <input
              type="number"
              min={1}
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Passing Marks
            </label>
            <input
              type="number"
              min={0}
              value={passMarks}
              onChange={(e) => setPassMarks(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Grading Type
            </label>
            <select
              value={gradingType}
              onChange={(e) => setGradingType(e.target.value as GradingType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="MARKS">Marks (e.g. 85/100)</option>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="PASS_FAIL">Pass / Fail</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Max Attempts
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Rubric Builder */}
        <div className="pt-4 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Evaluation Rubric</h3>
              <p className="text-xs text-muted-foreground">
                Total Rubric Marks: <span className="font-bold text-primary">{totalRubricMarks}</span> / {maxMarks}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRubricRow} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Criterion
            </Button>
          </div>

          <div className="space-y-2">
            {rubricCriteria.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-background p-3">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Criterion Name (e.g. Research Depth)"
                      value={c.criterion}
                      onChange={(e) => updateRubricRow(i, "criterion", e.target.value)}
                      className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="number"
                      placeholder="Marks"
                      value={c.maxMarks}
                      onChange={(e) => updateRubricRow(i, "maxMarks", Number(e.target.value))}
                      className="w-24 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description / Requirements for full marks..."
                    value={c.description || ""}
                    onChange={(e) => updateRubricRow(i, "description", e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRubricRow(i)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive mt-1"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. GAMIFICATION */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Award className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">6. Gamification & XP Reward</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              XP Reward *
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={10000}
                value={xpReward}
                onChange={(e) => setXpReward(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-bold text-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-500">XP</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Awarded once upon passing grade. Idempotency guarantees no duplicate XP on resubmissions.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Environmental Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Waste Management, Climate Action"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 7. LEARNING RESOURCES */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <FolderPlus className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">7. Attach Learning Resources</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Add External Reference Links / Videos
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={externalUrlInput}
                onChange={(e) => setExternalUrlInput(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button type="button" variant="outline" size="sm" onClick={addExternalLink} className="gap-1">
                <LinkIcon className="h-3.5 w-3.5" />
                Add Link
              </Button>
            </div>

            {externalUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {externalUrls.map((url, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium">
                    <LinkIcon className="h-3 w-3 text-primary" />
                    {url}
                    <button
                      type="button"
                      onClick={() => setExternalUrls(externalUrls.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 8. PUBLICATION & ACTIONS */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => handleSubmit(false)}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save as Draft
        </Button>

        <Button
          type="button"
          disabled={saving}
          onClick={() => handleSubmit(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md"
        >
          <Send className="h-4 w-4" />
          {saving ? "Publishing..." : "Publish Assignment"}
        </Button>
      </div>
    </div>
  );
}
