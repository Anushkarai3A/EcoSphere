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
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { formatApiError, quizApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { difficultyLabel, formatDate, questDifficulties } from "@/lib/quests";
import { quizStatusLabels, quizTopicLabel } from "@/lib/quizzes";
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

const fieldBase =
  "w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35";
const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const statusTone: Record<string, string> = {
  DRAFT: "border-frost/30 bg-white/[0.06] text-ash",
  PUBLISHED: "border-emerald/40 bg-emerald/10 text-emerald",
  ARCHIVED: "border-gold/40 bg-gold/10 text-gold",
};

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-12 sm:px-10">
        <SectionHead kicker="Restricted" title="AI Quiz Studio" />
        <MetaRow>
          <span>Only verified teachers can generate and manage quizzes.</span>
        </MetaRow>
      </div>
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
      setFormError(formatApiError(err, "Failed to generate quiz."));
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
        <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
          <MetaRow>
            <span>Teacher workspace</span>
            <span>{items.length} quizzes</span>
          </MetaRow>
          <DisplayTitle lines={["QUIZ", "STUDIO"]} />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
              Generate quizzes from your study materials, review the questions, then publish for students.
            </p>
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" aria-hidden />
              {showForm ? "Close form" : "Generate quiz"}
            </Button>
          </div>
        </section>

        <Rule />

        <section className="flex flex-col gap-5">
          {listError && (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive"
            >
              {listError}
            </p>
          )}

          {showForm && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[22px]">Generate a quiz</CardTitle>
                <CardDescription className="max-w-xl uppercase leading-[1.6]">
                  The AI extracts text from your study material and drafts multiple-choice questions strictly from its
                  content. Review as a draft, then publish when ready.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onGenerate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="qz-title">Quiz title</Label>
                    <Input
                      id="qz-title"
                      required
                      maxLength={120}
                      placeholder="e.g. Biodiversity basics"
                      value={form.title}
                      onChange={(e) => set("title", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qz-desc">Description</Label>
                    <textarea
                      id="qz-desc"
                      rows={2}
                      maxLength={1000}
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      className={cn(fieldBase, "resize-y")}
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
                      <select
                        id="qz-diff"
                        className={cn(fieldBase, "h-10")}
                        value={form.difficulty}
                        onChange={(e) => set("difficulty", e.target.value as QuestDifficulty)}
                      >
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
                      <Input
                        id="qz-count"
                        type="number"
                        min={5}
                        max={50}
                        required
                        value={form.count}
                        onChange={(e) => set("count", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qz-pass">Pass threshold %</Label>
                      <Input
                        id="qz-pass"
                        type="number"
                        min={0}
                        max={100}
                        value={form.passThreshold}
                        onChange={(e) => set("passThreshold", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qz-time">Time limit (min, optional)</Label>
                      <Input
                        id="qz-time"
                        type="number"
                        min={1}
                        max={120}
                        value={form.timeLimitMin}
                        onChange={(e) => set("timeLimitMin", e.target.value)}
                        placeholder="None"
                      />
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
                    <p className="font-micro text-[11px] uppercase leading-[1.6] text-ash">
                      PDF, DOCX, PPT or TXT. Questions are generated only from this document's content — upload
                      different notes to get different quizzes.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 font-micro text-[11px] uppercase text-bone">
                    <input
                      type="checkbox"
                      checked={form.publish}
                      onChange={(e) => set("publish", e.target.checked)}
                      className="h-4 w-4 accent-emerald"
                    />
                    Publish immediately (skip the draft review step)
                  </label>

                  {formError && (
                    <p
                      role="alert"
                      className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive"
                    >
                      {formError}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 border-t border-frost/15 pt-4">
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

          <div className="inline-flex w-fit flex-wrap gap-1 rounded-full border border-frost/20 bg-deep/60 p-1">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-micro text-[10px] uppercase tracking-[0.06em] transition-colors",
                  filter === f.value
                    ? "bg-emerald/15 text-emerald shadow-[inset_0_0_0_1px_rgba(46,207,143,0.45)]"
                    : "text-ash hover:text-bone",
                )}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {quizzes.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
              <p className="font-micro text-[11px] uppercase text-ash">Loading quizzes…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
              <Logo className="h-12 w-12 opacity-80" />
              <p className="font-micro text-[11px] uppercase text-ash">
                No quizzes here yet. Generate your first quiz to get started.
              </p>
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Generate quiz
              </Button>
            </div>
          ) : (
            <div className="flex flex-col">
              <SectionHead
                kicker={`${items.length} shown`}
                title="Quizzes"
                right={
                  <span className="font-micro text-[10px] uppercase text-ash">
                    {statusFilters.find((f) => f.value === filter)?.label ?? "All"} · {items.length} total
                  </span>
                }
              />
              <div className="mt-2 flex flex-col">
                {items.map((quiz) => {
                  const topicLabel = quizTopicLabel(quiz.topic);
                  const busy = busyId === quiz.id;
                  return (
                    <div
                      key={quiz.id}
                      className="flex flex-col gap-3 border-t border-frost/10 py-4 transition-colors last:border-b hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(chipBase, "border-frost/30 bg-white/[0.06] text-ash")}>{topicLabel}</span>
                          <span className={cn(chipBase, statusTone[quiz.status] ?? "border-frost/30 bg-white/[0.06] text-ash")}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                            {quizStatusLabels[quiz.status]}
                          </span>
                          <span className="font-micro text-[10px] uppercase text-ash">
                            {difficultyLabel(quiz.difficulty)}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate font-display text-[22px] font-medium leading-none text-bone">
                          {quiz.title}
                        </h3>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-micro text-[10px] uppercase text-ash">
                          <span>{quiz.questionCount} questions</span>
                          <span>
                            {quiz._count.attempts} attempt{quiz._count.attempts === 1 ? "" : "s"}
                          </span>
                          {quiz.passThreshold != null && <span>{quiz.passThreshold}% to pass</span>}
                          {quiz.timeLimitMin != null && <span>{quiz.timeLimitMin} min</span>}
                          <span>{formatDate(quiz.createdAt)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="glass-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[20px] bg-[#04171d]/95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-frost/15 px-5 py-4">
          <div className="min-w-0 flex-1">
            <SectionHead kicker="Quiz detail" title={quiz?.title ?? "Quiz"} />
            <p className="mt-2 font-micro text-[11px] uppercase leading-[1.6] text-ash">
              {quiz
                ? `${quiz.questionCount} questions · ${difficultyLabel(quiz.difficulty)} · ${quizStatusLabels[quiz.status]}`
                : "Loading…"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          {query.isLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
              <span className="font-micro text-[11px] uppercase text-ash">Loading questions…</span>
            </div>
          )}
          {query.error instanceof Error && (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive"
            >
              {query.error.message}
            </p>
          )}
          {quiz?.questions?.map((q) => (
            <div key={q.id} className="rounded-[10px] border border-frost/20 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-bone">
                  <span className="mr-2 font-micro text-[11px] text-cyan">
                    {String(q.position + 1).padStart(2, "0")}
                  </span>
                  {q.prompt}
                </p>
                <span className={cn(chipBase, "shrink-0 border-frost/30 bg-white/[0.06] text-ash")}>MCQ</span>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {q.options.map((opt, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-[6px] border px-3 py-1.5 text-sm",
                      i === q.correctIndex
                        ? "border-emerald/50 bg-emerald/10 text-bone"
                        : "border-frost/15 bg-deep/40 text-ash",
                    )}
                  >
                    <span className="mr-2 font-micro text-[10px] uppercase">{String.fromCharCode(65 + i)}.</span>
                    {opt.text}
                    {i === q.correctIndex && (
                      <span className="ml-2 font-micro text-[10px] uppercase text-emerald">Correct answer</span>
                    )}
                  </div>
                ))}
              </div>
              {q.explanation && <p className="mt-2 font-micro text-[11px] uppercase leading-[1.6] text-ash">{q.explanation}</p>}
            </div>
          ))}
          {quiz && quiz.questions?.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-8 text-center">
              <Logo className="h-10 w-10 opacity-80" />
              <p className="font-micro text-[11px] uppercase text-ash">No questions attached to this quiz yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
