import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  Eye,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quizApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { difficultyLabel, formatDate, questDifficulties } from "@/lib/quests";
import { quizStatusLabels, quizStatusTone, quizTopicLabel } from "@/lib/quizzes";
import type { GenerateQuizInput, QuestDifficulty, QuizStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  useArchiveQuiz,
  useGenerateQuiz,
  usePublishQuiz,
  useTeacherQuizzes,
  useUnpublishQuiz,
  useUploadMaterial,
  quizKeys,
} from "@/hooks/useQuizzes";

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const statusFilters: ReadonlyArray<{ value: QuizStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

interface GenFormState {
  title: string;
  description: string;
  topic: string;
  difficulty: QuestDifficulty;
  count: string;
  passThreshold: string;
  timeLimitMin: string;
  publish: boolean;
  materialFile: File | null;
}

function emptyForm(): GenFormState {
  return {
    title: "",
    description: "",
    topic: "",
    difficulty: "MEDIUM",
    count: "10",
    passThreshold: "60",
    timeLimitMin: "",
    publish: false,
    materialFile: null,
  };
}

export function TeacherQuizzesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<QuizStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GenFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const quizzes = useTeacherQuizzes(filter === "ALL" ? undefined : filter);
  const generate = useGenerateQuiz();
  const upload = useUploadMaterial();
  const publish = usePublishQuiz();
  const unpublish = useUnpublishQuiz();
  const archive = useArchiveQuiz();

  if (user?.role !== "TEACHER") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Quiz Studio</CardTitle>
          <CardDescription>Only verified teachers can generate and manage quizzes.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function set<K extends keyof GenFormState>(key: K, value: GenFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const count = Number(form.count);
    if (!Number.isInteger(count) || count < 5 || count > 50) {
      setFormError("Question count must be between 5 and 50.");
      return;
    }
    if (!form.materialFile) {
      setFormError("Upload a study material (PDF, DOCX, PPT or TXT) — the quiz is generated from its content.");
      return;
    }

    setSubmitting(true);
    try {
      const { material } = await upload.mutateAsync(form.materialFile);

      const input: GenerateQuizInput = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        materialId: material.id,
        topic: form.topic.trim() || undefined,
        difficulty: form.difficulty,
        count,
        passThreshold: Number(form.passThreshold) || undefined,
        timeLimitMin: form.timeLimitMin.trim() ? Number(form.timeLimitMin) : undefined,
        publish: form.publish,
      };
      const { quiz } = await generate.mutateAsync(input);
      setShowForm(false);
      setForm(emptyForm());
      if (quiz.status === "DRAFT") setDetailId(quiz.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate quiz.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const items = quizzes.data ?? [];
  const listError = quizzes.error instanceof Error ? quizzes.error.message : null;
  const busyPublish = publish.isPending ? publish.variables : null;
  const busyUnpublish = unpublish.isPending ? unpublish.variables : null;
  const busyArchive = archive.isPending ? archive.variables : null;
  const busyId = busyPublish ?? busyUnpublish ?? busyArchive;

  return (
    <>
      <div className="flex flex-col gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden />
              AI Quiz Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate quizzes from your study materials, review the questions, then publish for students.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" aria-hidden />
            {showForm ? "Close form" : "Generate quiz"}
          </Button>
        </section>

        {listError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {listError}
          </p>
        )}

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Generate a quiz</CardTitle>
              <CardDescription>
                The AI extracts text from your study material and drafts multiple-choice questions strictly from its
                content. Review as a draft, then publish when ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onGenerate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qz-title">Quiz title</Label>
                  <Input id="qz-title" required maxLength={120} placeholder="e.g. Biodiversity basics" value={form.title} onChange={(e) => set("title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qz-desc">Description</Label>
                  <textarea
                    id="qz-desc"
                    rows={2}
                    maxLength={1000}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className={`${inputClass} h-auto`}
                    placeholder="What is this quiz about?"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="qz-topic">Subject (optional)</Label>
                    <Input
                      id="qz-topic"
                      maxLength={120}
                      placeholder="Auto-detected from the material (e.g. BDA)"
                      value={form.topic}
                      onChange={(e) => set("topic", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qz-diff">Difficulty</Label>
                    <select id="qz-diff" className={selectClass} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value as QuestDifficulty)}>
                      {questDifficulties.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="qz-count">Questions (5–50)</Label>
                    <Input id="qz-count" type="number" min={5} max={50} required value={form.count} onChange={(e) => set("count", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qz-pass">Pass threshold %</Label>
                    <Input id="qz-pass" type="number" min={0} max={100} value={form.passThreshold} onChange={(e) => set("passThreshold", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qz-time">Time limit (min, optional)</Label>
                    <Input id="qz-time" type="number" min={1} max={120} value={form.timeLimitMin} onChange={(e) => set("timeLimitMin", e.target.value)} placeholder="None" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qz-material">Study material</Label>
                  <Input
                    id="qz-material"
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => set("materialFile", e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX, PPT or TXT. Questions are generated only from this document's content — upload
                    different notes to get different quizzes.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.publish} onChange={(e) => set("publish", e.target.checked)} className="h-4 w-4 accent-primary" />
                  Publish immediately (skip the draft review step)
                </label>

                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Generate
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {quizzes.isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            No quizzes here yet. Generate your first quiz to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((quiz) => {
              const topicLabel = quizTopicLabel(quiz.topic);
              const busy = busyId === quiz.id;
              return (
                <Card key={quiz.id}>
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {topicLabel}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${quizStatusTone[quiz.status]}`}>
                          {quizStatusLabels[quiz.status]}
                        </span>
                        <span className="text-xs font-semibold text-primary">{difficultyLabel(quiz.difficulty)}</span>
                      </div>
                      <h3 className="mt-1 truncate font-semibold">{quiz.title}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{quiz.questionCount} questions</span>
                        <span>{quiz._count.attempts} attempt{quiz._count.attempts === 1 ? "" : "s"}</span>
                        {quiz.passThreshold != null && <span>{quiz.passThreshold}% to pass</span>}
                        {quiz.timeLimitMin != null && <span>{quiz.timeLimitMin} min</span>}
                        <span>{formatDate(quiz.createdAt)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(quiz.id)}>
                        <Eye className="h-4 w-4" aria-hidden />
                        View
                      </Button>
                      {quiz.status === "DRAFT" && (
                        <Button size="sm" disabled={busy} onClick={() => publish.mutate(quiz.id)}>
                          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                          <Send className="h-4 w-4" aria-hidden />
                          Publish
                        </Button>
                      )}
                      {quiz.status === "PUBLISHED" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => unpublish.mutate(quiz.id)}>
                          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                          <Archive className="h-4 w-4" aria-hidden />
                          Unpublish
                        </Button>
                      )}
                      {quiz.status !== "ARCHIVED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("Archive this quiz? Students will no longer see it.")) {
                              archive.mutate(quiz.id);
                            }
                          }}
                        >
                          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {detailId && <QuizDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function QuizDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: quizKeys.teacherQuiz(id),
    queryFn: async () => (await quizApi.get(id)).quiz,
  });
  const quiz = query.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{quiz?.title ?? "Quiz"}</h2>
            <p className="text-sm text-muted-foreground">
              {quiz ? `${quiz.questionCount} questions · ${difficultyLabel(quiz.difficulty)} · ${quizStatusLabels[quiz.status]}` : "Loading…"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          {query.isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Loading questions…
            </div>
          )}
          {query.error instanceof Error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {query.error.message}
            </p>
          )}
          {quiz?.questions?.map((q) => (
            <div key={q.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">
                  {q.position + 1}. {q.prompt}
                </p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  MCQ
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {q.options.map((opt, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm",
                      i === q.correctIndex
                        ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-800"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <span className="mr-2 font-mono text-xs">{String.fromCharCode(65 + i)}.</span>
                    {opt.text}
                    {i === q.correctIndex && (
                      <span className="ml-2 text-xs font-bold text-emerald-700">Correct answer</span>
                    )}
                  </div>
                ))}
              </div>
              {q.explanation && <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>}
            </div>
          ))}
          {quiz && quiz.questions?.length === 0 && (
            <p className="rounded-md border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
              No questions attached to this quiz yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
