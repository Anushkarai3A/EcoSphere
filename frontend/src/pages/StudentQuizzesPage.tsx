import { ArrowLeft, CheckCircle2, FileQuestion, Loader2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead, Stat } from "@/components/gallery";
import { useAuth } from "@/lib/auth";
import { difficultyLabel, formatDate } from "@/lib/quests";
import { questionTypeLabel, quizTopicLabel } from "@/lib/quizzes";
import type { QuizAnswerInput, QuizAttemptResult, QuizQuestionStudent, StudentQuiz } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStudentQuiz, useStudentQuizzes, useSubmitQuizAttempt } from "@/hooks/useQuizzes";

type View = "list" | "taking" | "result";

export function StudentQuizzesPage() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const feed = useStudentQuizzes();
  const quizQuery = useStudentQuiz(activeId, view === "taking");
  const submit = useSubmitQuizAttempt(activeId);

  const quiz = quizQuery.data;

  function startQuiz(id: string) {
    setActiveId(id);
    setAnswers({});
    setResult(null);
    setView("taking");
  }

  async function onSubmit() {
    if (!quiz) return;
    const entries: QuizAnswerInput[] = [];
    for (const q of quiz.questions) {
      const selectedIndex = answers[q.id];
      if (typeof selectedIndex === "number") entries.push({ questionId: q.id, selectedIndex });
    }
    const unanswered = quiz.questions.length - entries.length;
    if (unanswered > 0 && !window.confirm(`${unanswered} question${unanswered === 1 ? "" : "s"} left unanswered. Submit anyway?`)) {
      return;
    }
    const res = await submit.mutateAsync(entries);
    setResult(res);
    setView("result");
  }

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (user?.role !== "STUDENT") {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-12 sm:px-10">
        <SectionHead kicker="Restricted" title="Quizzes" />
        <MetaRow>
          <span>Published quizzes appear here for students.</span>
        </MetaRow>
      </div>
    );
  }

  if (view === "taking" && quiz) {
    const total = quiz.questions.length;
    const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-16 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3 pt-12">
          <div>
            <MetaRow>
              <span className="text-cyan">Assessment in progress</span>
              <span>{difficultyLabel(quiz.difficulty)}</span>
              <span>{quiz.questions.length} questions</span>
              {quiz.timeLimitMin != null ? <span>{quiz.timeLimitMin} min</span> : null}
              {quiz.passThreshold != null ? <span>{quiz.passThreshold}% to pass</span> : null}
            </MetaRow>
            <h1 className="mt-3 font-display text-[30px] font-normal leading-none text-bone sm:text-[40px]">
              {quiz.title}
            </h1>
          </div>
          <Button variant="outline" onClick={() => setView("list")}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Exit quiz
          </Button>
        </div>

        {quiz.description && (
          <p className="max-w-3xl text-sm text-ash">
            {quiz.description}
          </p>
        )}

        {quizQuery.isFetching && !quizQuery.isLoading && (
          <p className="font-micro text-[10px] uppercase text-ash">Refreshing…</p>
        )}

        <div className="flex flex-col">
          {quiz.questions.map((q) => (
            <QuestionCard key={q.id} question={q} selected={answers[q.id]} onSelect={(i) => setAnswers((prev) => ({ ...prev, [q.id]: i }))} />
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-frost/15 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-micro text-[11px] uppercase text-ash">
              Answered <span className="font-title text-[15px] font-semibold tracking-normal text-cyan">{answeredCount}</span> of {quiz.questions.length}
            </p>
            <Button onClick={() => void onSubmit()} disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Submit answers
            </Button>
          </div>
          <div className="h-px w-full bg-frost/20" aria-hidden>
            <div className="h-px bg-cyan transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {submit.error instanceof Error && (
          <p role="alert" className="border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
            {submit.error.message}
          </p>
        )}
      </div>
    );
  }

  if (view === "result" && result) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-16 sm:px-10">
        <section className="flex flex-wrap items-end justify-between gap-3 pt-12">
          <div>
            <MetaRow>
              <span>Mission result</span>
              <span>{quiz?.title ?? "Attempt summary"}</span>
            </MetaRow>
          </div>
          <Button onClick={() => setView("list")}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to quizzes
          </Button>
        </section>

        <div className="glass-panel flex flex-col items-start gap-3 rounded-[10px] px-6 py-8">
          {result.attempt.passed ? (
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-emerald/50 bg-emerald/10 px-2 py-1 font-micro text-[10px] uppercase tracking-[0.08em] text-emerald">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Passed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-destructive/50 bg-destructive/10 px-2 py-1 font-micro text-[10px] uppercase tracking-[0.08em] text-destructive">
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              Not passed
            </span>
          )}
          <p className="font-title text-[clamp(56px,10vw,80px)] font-semibold leading-[0.85] text-gold text-glow-gold">
            {result.attempt.score}
            <span className="text-bone/70">/{result.attempt.maxScore}</span>
          </p>
          <p className="font-micro text-[11px] uppercase text-ash">
            {result.attempt.passed ? "Passed" : "Not passed — review below and retry"} — submitted {formatDate(result.attempt.submittedAt)}
          </p>
        </div>

        <div className="flex flex-col">
          {result.results.map((r) => (
            <ResultCard key={r.questionId} item={r} options={quiz?.questions.find((q) => q.id === r.questionId)?.options ?? []} />
          ))}
        </div>
      </div>
    );
  }

  // List view
  const items = feed.data ?? [];
  const feedError = feed.error instanceof Error ? feed.error.message : null;
  const passedCount = items.filter((qz) => qz.myAttempt?.passed).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Mission briefing</span>
          <span>{items.length} published</span>
          <span>{passedCount} passed</span>
        </MetaRow>
        <DisplayTitle lines={["QUIZ", "ROOM"]} />
        <MetaRow>
          <span>Your teachers&apos; published quizzes. Earn XP when you pass.</span>
        </MetaRow>
        <div className="flex flex-wrap gap-x-16 gap-y-6 pt-2">
          <Stat value={String(items.length)} caption="Published" />
          <Stat value={String(items.filter((qz) => qz.myAttempt).length)} caption="Attempted" />
          <Stat value={String(passedCount)} caption="Passed" accent={passedCount > 0} />
        </div>
      </section>

      <Rule />

      {feedError && (
        <p role="alert" className="border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
          {feedError}
        </p>
      )}

      {feed.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-cyan" aria-hidden />
          <span className="font-micro text-[11px] uppercase text-ash">Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-frost/30 bg-deep/40 px-4 py-10 text-center">
          <p className="font-micro text-[11px] uppercase text-ash">
            No quizzes have been published for you yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          <SectionHead kicker="Open" title="Available" />
          <ul className="mt-2 flex flex-col">
            {items.map((qz) => (
              <QuizCard key={qz.id} quiz={qz} onTake={() => startQuiz(qz.id)} />
            ))}
          </ul>
          <Rule />
        </div>
      )}
    </div>
  );
}

function QuizCard({ quiz, onTake }: { quiz: StudentQuiz; onTake: () => void }) {
  const chipBase = "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 font-micro text-[10px] uppercase tracking-[0.08em]";
  const attemptChip = !quiz.myAttempt ? (
    <span className={`${chipBase} border-frost/30 bg-white/[0.03] text-ash`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ash" />
      Not attempted
    </span>
  ) : quiz.myAttempt.passed ? (
    <span className={`${chipBase} border-emerald/50 bg-emerald/10 text-emerald`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_8px_rgba(46,207,143,0.9)]" />
      Passed
    </span>
  ) : (
    <span className={`${chipBase} border-destructive/50 bg-destructive/10 text-destructive`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
      Attempted
    </span>
  );

  return (
    <li className="flex flex-col gap-3 border-t border-frost/15 py-5 last:border-b sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-micro text-[10px] uppercase text-ash">
          <span>{quizTopicLabel(quiz.topic)}</span>
          <span className="text-frost/40">/</span>
          <span>{difficultyLabel(quiz.difficulty)}</span>
          {attemptChip}
        </div>
        <h3 className="mt-2 truncate font-display text-[22px] font-normal leading-none text-bone transition-colors hover:text-cyan">{quiz.title}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-micro text-[10px] uppercase text-ash">
          <span>{quiz.questionCount} questions</span>
          {quiz.timeLimitMin != null && <span>{quiz.timeLimitMin} min</span>}
          <span>
            by {quiz.teacher.firstName} {quiz.teacher.lastName}
          </span>
          {quiz.myAttempt && (
            <span className="font-title text-[15px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
              Score {quiz.myAttempt.score}/{quiz.myAttempt.maxScore}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {quiz.myAttempt && (
          <Button size="sm" variant="ghost" onClick={onTake}>
            <FileQuestion className="h-3.5 w-3.5" aria-hidden />
            Retake
          </Button>
        )}
        <Button size="sm" onClick={onTake}>
          {quiz.myAttempt ? "Retake quiz" : "Take quiz"}
        </Button>
      </div>
    </li>
  );
}

function QuestionCard({
  question,
  selected,
  onSelect,
}: {
  question: QuizQuestionStudent;
  selected?: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="border-t border-frost/15 py-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-normal text-bone">
          <span className="mr-2 font-micro text-[11px] text-cyan">{String(question.position + 1).padStart(2, "0")}</span>
          {question.prompt}
        </p>
        <span className="shrink-0 font-micro text-[10px] uppercase text-ash">
          {questionTypeLabel(question.qType)}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {question.options.map((opt, i) => (
          <label
            key={i}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-[6px] border px-3 py-2.5 text-sm transition-colors",
              selected === i
                ? "border-cyan/70 bg-cyan/10 text-bone shadow-[0_0_18px_-10px_rgba(95,224,232,0.9)]"
                : "border-frost/25 bg-deep/40 text-bone/85 hover:border-frost/60 hover:text-bone",
            )}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={selected === i}
              onChange={() => onSelect(i)}
              className="mt-0.5 h-4 w-4 accent-emerald"
            />
            <span>
              <span className="mr-1 font-mono text-xs text-ash">{String.fromCharCode(65 + i)}.</span>
              {opt.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ item, options }: { item: QuizAttemptResult["results"][number]; options: { text: string }[] }) {
  return (
    <div className="border-t border-frost/15 py-5 last:border-b">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-normal text-bone">{item.prompt}</p>
        {item.correct ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-emerald/50 bg-emerald/10 px-2 py-1 font-micro text-[10px] uppercase tracking-[0.08em] text-emerald">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Correct
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-destructive/50 bg-destructive/10 px-2 py-1 font-micro text-[10px] uppercase tracking-[0.08em] text-destructive">
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            Incorrect
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((opt, i) => {
          const isCorrect = i === item.correctIndex;
          const isSelected = i === item.selectedIndex;
          return (
            <div
              key={i}
              className={cn(
                "rounded-[6px] border px-3 py-1.5 text-sm",
                isCorrect
                  ? "border-emerald/50 bg-emerald/10 text-bone"
                  : isSelected
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-frost/15 bg-deep/40 text-ash",
              )}
            >
              <span className="mr-2 font-mono text-xs">{String.fromCharCode(65 + i)}.</span>
              {opt.text}
              {isCorrect && <span className="ml-2 font-micro text-[10px] uppercase text-emerald">Correct answer</span>}
              {isSelected && !isCorrect && <span className="ml-2 font-micro text-[10px] uppercase text-destructive">Your answer</span>}
            </div>
          );
        })}
      </div>
      {item.explanation && <p className="mt-2 text-xs text-ash">{item.explanation}</p>}
    </div>
  );
}
