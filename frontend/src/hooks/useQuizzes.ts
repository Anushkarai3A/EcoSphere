import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "@/lib/api";
import type { GenerateQuizInput, QuizAnswerInput, QuizStatus } from "@/lib/types";

export const quizKeys = {
  teacherQuizzes: ["teacher-quizzes"] as const,
  teacherQuiz: (id: string) => ["teacher-quizzes", id] as const,
  studentQuizzes: ["student-quizzes"] as const,
  studentQuiz: (id: string) => ["student-quizzes", id] as const,
};

/** Teacher's own quiz studio feed (drafts + live + archived). */
export function useTeacherQuizzes(status?: QuizStatus) {
  return useQuery({
    queryKey: [...quizKeys.teacherQuizzes, status ?? "all"] as const,
    queryFn: async () => (await quizApi.list(status ? { status } : {})).items,
    staleTime: 30_000,
  });
}

export function useGenerateQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateQuizInput) => quizApi.generate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.teacherQuizzes });
    },
  });
}

export function useUploadMaterial() {
  return useMutation({
    mutationFn: (file: File) => quizApi.uploadMaterial(file),
  });
}

function useQuizStatusMutation(
  mutationFn: (id: string) => Promise<unknown>,
  invalidate: (queryClient: ReturnType<typeof useQueryClient>) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidate(queryClient),
  });
}

export function usePublishQuiz() {
  return useQuizStatusMutation((id) => quizApi.publish(id), (qc) => {
    void qc.invalidateQueries({ queryKey: quizKeys.teacherQuizzes });
    void qc.invalidateQueries({ queryKey: quizKeys.studentQuizzes });
  });
}

export function useUnpublishQuiz() {
  return useQuizStatusMutation((id) => quizApi.unpublish(id), (qc) => {
    void qc.invalidateQueries({ queryKey: quizKeys.teacherQuizzes });
    void qc.invalidateQueries({ queryKey: quizKeys.studentQuizzes });
  });
}

export function useArchiveQuiz() {
  return useQuizStatusMutation((id) => quizApi.remove(id), (qc) => {
    void qc.invalidateQueries({ queryKey: quizKeys.teacherQuizzes });
    void qc.invalidateQueries({ queryKey: quizKeys.studentQuizzes });
  });
}

/** Published quizzes available to the signed-in student. */
export function useStudentQuizzes() {
  return useQuery({
    queryKey: quizKeys.studentQuizzes,
    queryFn: async () => (await quizApi.studentList()).items,
    staleTime: 30_000,
  });
}

/** Student-facing quiz detail (questions, no correct answers). */
export function useStudentQuiz(id: string | null, enabled = true) {
  return useQuery({
    queryKey: quizKeys.studentQuiz(id ?? "none"),
    queryFn: async () => (await quizApi.studentGet(id as string)).quiz,
    enabled: enabled && Boolean(id),
  });
}

export function useSubmitQuizAttempt(quizId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: QuizAnswerInput[]) =>
      quizApi.studentAttempt(quizId as string, answers),
    onSuccess: () => {
      if (quizId) {
        void queryClient.invalidateQueries({ queryKey: quizKeys.studentQuiz(quizId) });
        void queryClient.invalidateQueries({ queryKey: quizKeys.studentQuizzes });
      }
    },
  });
}
