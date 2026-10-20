import type {
  AcceptanceDetail,
  Assignment,
  AssignmentSubmission,
  AuthSession,
  CreateAssignmentInput,
  CreateQuestInput,
  GenerateQuizInput,
  GradeAssignmentSubmissionInput,
  Institution,
  LoginInput,
  MyAcceptance,
  NearbyQuest,
  Paginated,
  PaginatedInvitations,
  Quest,
  Quiz,
  QuizAnswerInput,
  QuizAttemptResult,
  QuizStatus,
  RegisterStudentInput,
  RegisterTeacherInput,
  ReviewDecisionInput,
  ReviewQueueItem,
  SafeUser,
  StudentQuiz,
  StudentQuizDetail,
  StudyMaterial,
  Submission,
  SubmitAssignmentInput,
  SubmitEvidenceInput,
  TeacherProfileData,
  UpdateAssignmentInput,
  UpdateTeacherProfileInput,
  UpdateQuestInput,
  UserListItem,
  UserStatusFilter,
  StudentDashboardData,
  StudentLeaderboardResponse,
  StudentProfileData,
  UpdateStudentProfileInput,
  StudentBadge,
  StudentAnimation,
  GenerateAnimationInput,
} from "./types";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, error: ApiErrorBody["error"]) {
    super(error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

/** Render an API failure without leaking raw responses or stack traces. */
export function formatApiError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error && err.message ? err.message : fallback;
  }
  if (err.status === 422 && err.details) {
    const fields = Object.entries(err.details)
      .flatMap(([field, value]) =>
        Array.isArray(value) ? value.map((message) => `${field}: ${String(message)}`) : [`${field}: ${String(value)}`],
      )
      .slice(0, 3);
    if (fields.length > 0) return `${err.message} (${fields.join("; ")})`;
  }
  return err.message;
}

function fallbackError(status: number): ApiErrorBody["error"] {
  const messages: Record<number, string> = {
    400: "The request was not accepted. Check the submitted values and try again.",
    401: "Your session has expired. Please sign in again.",
    403: "You do not have permission to perform this action.",
    404: "The requested resource was not found.",
    409: "The request conflicts with the current state. Refresh and try again.",
    413: "The uploaded file is too large.",
    422: "The request could not be validated. Check the submitted values.",
    429: "Too many requests. Please wait a moment and try again.",
    502: "The AI service returned an invalid response. Please retry.",
    503: "The AI service is not configured or is temporarily unavailable.",
    504: "The AI service took too long to respond. Please retry.",
  };
  return {
    code: `HTTP_${status}`,
    message: messages[status] ?? `The server could not complete the request (HTTP ${status}).`,
  };
}

function transportError(err: unknown): ApiError {
  const aborted =
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError");
  if (aborted) {
    return new ApiError(0, {
      code: "REQUEST_TIMEOUT",
      message: "The request timed out before the server responded. Please retry.",
    });
  }
  return new ApiError(0, {
    code: "NETWORK_ERROR",
    message: "Unable to reach the Ecosphere server. Check that the backend is running, then retry.",
  });
}

/** Fired when the refresh endpoint rejects the stored session (expired/revoked). */
type SessionExpiredHandler = () => void;

const API_BASE = "/api/v1";

// The access token lives only in memory: it is never persisted, so XSS can't
// exfiltrate it. The long-lived refresh token stays in the httpOnly cookie.
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

/** Single-flight refresh: concurrent 401s share one /auth/refresh call. */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401) {
          sessionExpiredHandler?.();
          return null;
        }
        if (!res.ok) return null;
        const session = (await res.json()) as AuthSession;
        accessToken = session.accessToken;
        return session.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const raw = await res.text().catch(() => "");
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const envelope = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, envelope ?? fallbackError(res.status));
  }
  if (body === null) {
    throw new ApiError(502, {
      code: "INVALID_RESPONSE",
      message: "The server returned an unreadable response. Please retry.",
    });
  }
  return body as T;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const request = async (): Promise<Response> => {
    try {
      return await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
    } catch (err) {
      throw transportError(err);
    }
  };

  let res = await request();

  // Token may have expired; try one rotating refresh then replay the request.
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed}`);
      res = await request();
    }
  }

  return parseResponse<T>(res);
}

export const authApi = {
  registerStudent: (input: RegisterStudentInput) =>
    apiFetch<{ user: SafeUser }>("/auth/register/student", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  registerTeacher: (input: RegisterTeacherInput) =>
    apiFetch<{ user: SafeUser }>("/auth/register/teacher", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: LoginInput) =>
    apiFetch<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  refresh: async (): Promise<AuthSession> => {
    const accessToken = await refreshAccessToken();
    if (!accessToken) {
      throw new ApiError(401, {
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please sign in again.",
      });
    }
    const { user } = await apiFetch<{ user: SafeUser }>("/auth/me");
    return { user, accessToken };
  },
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ user: SafeUser }>("/auth/me"),
  listInstitutions: () =>
    apiFetch<{ institutions: Institution[] }>("/auth/institutions"),
};

export interface NearbyQuestsParams {
  lat: number;
  lng: number;
  radius?: number;
  category?: string;
  limit?: number;
}

export const questApi = {
  nearby: (params: NearbyQuestsParams) => {
    const search = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      radius: String(params.radius ?? 10000),
      limit: String(params.limit ?? 250),
    });
    if (params.category) search.set("category", params.category);
    return apiFetch<{ quests: NearbyQuest[] }>(`/quests/nearby?${search.toString()}`);
  },
  list: (status?: string) => {
    const search = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<Paginated<Quest>>(`/quests${search}`);
  },
  get: (id: string) => apiFetch<{ quest: Quest }>(`/quests/${id}`),
  create: (input: CreateQuestInput) =>
    apiFetch<{ quest: Quest }>("/quests", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateQuestInput) =>
    apiFetch<{ quest: Quest }>(`/quests/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<void>(`/quests/${id}`, { method: "DELETE" }),
  publish: (id: string) =>
    apiFetch<{ quest: Quest }>(`/quests/${id}/publish`, { method: "POST", body: "{}" }),
  unpublish: (id: string) =>
    apiFetch<{ quest: Quest }>(`/quests/${id}/unpublish`, { method: "POST", body: "{}" }),
};

export const participationApi = {
  accept: (questId: string) =>
    apiFetch<{ acceptance: MyAcceptance }>(`/quests/${questId}/accept`, {
      method: "POST",
      body: "{}",
    }),
  myAcceptances: () => apiFetch<{ items: MyAcceptance[] }>("/student/acceptances"),
  getAcceptance: (id: string) =>
    apiFetch<{ acceptance: AcceptanceDetail }>(`/acceptances/${id}`),
  submitEvidence: (acceptanceId: string, files: File[], input: SubmitEvidenceInput) => {
    const form = new FormData();
    for (const file of files) form.append("evidence", file, file.name);
    form.set("lat", String(input.lat));
    form.set("lng", String(input.lng));
    if (input.accuracy !== undefined) form.set("accuracy", String(input.accuracy));
    if (input.deviceTimestamp) form.set("deviceTimestamp", input.deviceTimestamp);
    if (input.notes) form.set("notes", input.notes);
    return apiFetch<{ submission: Submission }>(`/acceptances/${acceptanceId}/submit`, {
      method: "POST",
      body: form,
    });
  },
};

export const reviewApi = {
  queue: () => apiFetch<{ items: ReviewQueueItem[]; count: number }>("/review/queue"),
  decide: (submissionId: string, input: ReviewDecisionInput) =>
    apiFetch<{ submission: Submission }>(`/submissions/${submissionId}/review`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export interface ListUsersParams {
  status?: UserStatusFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}

function listQuery(params: ListUsersParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const adminApi = {
  listTeachers: (params: ListUsersParams = {}) =>
    apiFetch<Paginated<UserListItem>>(`/admin/teachers${listQuery(params)}`),
  listStudents: (params: ListUsersParams = {}) =>
    apiFetch<Paginated<UserListItem>>(`/admin/students${listQuery(params)}`),
  approveTeacher: (userId: string) =>
    apiFetch<void>(`/admin/teachers/${userId}/approve`, { method: "PATCH" }),
  rejectTeacher: (userId: string, reason?: string) =>
    apiFetch<void>(`/admin/teachers/${userId}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  suspendTeacher: (userId: string) =>
    apiFetch<void>(`/admin/teachers/${userId}/suspend`, { method: "PATCH" }),
  deleteTeacher: (userId: string) =>
    apiFetch<void>(`/admin/teachers/${userId}`, { method: "DELETE" }),
  // Teacher verification
  verifyTeacher: (userId: string) =>
    apiFetch<void>(`/admin/teachers/${userId}/verify`, { method: "POST", body: "{}" }),
  rejectTeacherVerification: (userId: string, reason?: string) =>
    apiFetch<void>(`/admin/teachers/${userId}/reject-verification`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  // Invitations
  createInvitation: (email: string, role: "TEACHER" | "STUDENT" = "TEACHER") =>
    apiFetch<{ id: string; token: string; email: string; expiresAt: string }>("/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  listInvitations: (params: { page?: number; pageSize?: number; role?: string; status?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.page) search.set("page", String(params.page));
    if (params.pageSize) search.set("pageSize", String(params.pageSize));
    if (params.role) search.set("role", params.role);
    if (params.status) search.set("status", params.status);
    const qs = search.toString();
    return apiFetch<PaginatedInvitations>(`/admin/invitations${qs ? `?${qs}` : ""}`);
  },
  revokeInvitation: (invitationId: string) =>
    apiFetch<void>(`/admin/invitations/${invitationId}`, { method: "DELETE" }),
};

export const teacherApi = {
  // Profile
  getProfile: () => apiFetch<TeacherProfileData>("/teacher/profile"),
  updateProfile: (input: UpdateTeacherProfileInput) =>
    apiFetch<TeacherProfileData>("/teacher/profile", { method: "PUT", body: JSON.stringify(input) }),
  assignInstitution: (schoolId: string) =>
    apiFetch<TeacherProfileData>("/teacher/institution", { method: "POST", body: JSON.stringify({ schoolId }) }),
  // Students
  listPendingStudents: (params: ListUsersParams = {}) =>
    apiFetch<Paginated<UserListItem>>(`/teacher/students/pending${listQuery(params)}`),
  listApprovedStudents: (params: ListUsersParams = {}) =>
    apiFetch<Paginated<UserListItem>>(`/teacher/students/approved${listQuery(params)}`),
  approveStudent: (userId: string) =>
    apiFetch<void>(`/teacher/students/${userId}/approve`, { method: "PATCH" }),
  rejectStudent: (userId: string, reason?: string) =>
    apiFetch<void>(`/teacher/students/${userId}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
};

export interface ListQuizzesParams {
  status?: QuizStatus;
  page?: number;
  pageSize?: number;
}

function quizzesQuery(params: ListQuizzesParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const quizApi = {
  // Teacher — AI Quiz Studio
  list: (params: ListQuizzesParams = {}) =>
    apiFetch<Paginated<Quiz>>(`/quizzes${quizzesQuery(params)}`),
  get: (id: string) => apiFetch<{ quiz: Quiz }>(`/quizzes/${id}`),
  generate: (input: GenerateQuizInput) =>
    apiFetch<{ quiz: Quiz }>("/quizzes/generate", { method: "POST", body: JSON.stringify(input) }),
  publish: (id: string) =>
    apiFetch<{ quiz: Quiz }>(`/quizzes/${id}/publish`, { method: "POST", body: "{}" }),
  unpublish: (id: string) =>
    apiFetch<{ quiz: Quiz }>(`/quizzes/${id}/unpublish`, { method: "POST", body: "{}" }),
  remove: (id: string) => apiFetch<void>(`/quizzes/${id}`, { method: "DELETE" }),
  uploadMaterial: (file: File) => {
    const form = new FormData();
    form.append("files", file, file.name);
    return apiFetch<{ material: StudyMaterial }>("/quizzes/materials", {
      method: "POST",
      body: form,
    });
  },
  // Student — take published quizzes
  studentList: () => apiFetch<{ items: StudentQuiz[] }>("/student/quizzes"),
  studentGet: (id: string) =>
    apiFetch<{ quiz: StudentQuizDetail }>(`/student/quizzes/${id}`),
  studentAttempt: (id: string, answers: QuizAnswerInput[]) =>
    apiFetch<QuizAttemptResult>(`/student/quizzes/${id}/attempt`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
};

export const assignmentApi = {
  // Teacher
  list: (status?: string) => {
    const search = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<Paginated<Assignment>>(`/assignments${search}`);
  },
  get: (id: string) => apiFetch<{ assignment: Assignment }>(`/assignments/${id}`),
  create: (input: CreateAssignmentInput) =>
    apiFetch<{ assignment: Assignment }>("/assignments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdateAssignmentInput) =>
    apiFetch<{ assignment: Assignment }>(`/assignments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) => apiFetch<void>(`/assignments/${id}`, { method: "DELETE" }),
  publish: (id: string) =>
    apiFetch<{ assignment: Assignment }>(`/assignments/${id}/publish`, {
      method: "POST",
      body: "{}",
    }),
  unpublish: (id: string) =>
    apiFetch<{ assignment: Assignment }>(`/assignments/${id}/unpublish`, {
      method: "POST",
      body: "{}",
    }),
  addMaterial: (id: string, files: File[], title?: string, notes?: string, externalUrl?: string) => {
    const form = new FormData();
    for (const f of files) form.append("files", f, f.name);
    if (title) form.set("title", title);
    if (notes) form.set("notes", notes);
    if (externalUrl) form.set("externalUrl", externalUrl);
    return apiFetch<{ material: StudyMaterial }>(`/assignments/${id}/materials`, {
      method: "POST",
      body: form,
    });
  },
  removeMaterial: (id: string, materialId: string) =>
    apiFetch<void>(`/assignments/${id}/materials/${materialId}`, { method: "DELETE" }),
  listSubmissions: (id: string, status?: string) => {
    const search = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<{ items: AssignmentSubmission[] }>(`/assignments/${id}/submissions${search}`);
  },
  gradeSubmission: (submissionId: string, input: GradeAssignmentSubmissionInput) =>
    apiFetch<{ submission: AssignmentSubmission }>(`/assignments/submissions/${submissionId}/grade`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  // Student
  studentList: () => apiFetch<{ items: Assignment[] }>("/student/assignments"),
  studentGet: (id: string) => apiFetch<{ assignment: Assignment }>(`/student/assignments/${id}`),
  studentSubmit: (id: string, files: File[], input: SubmitAssignmentInput) => {
    const form = new FormData();
    for (const f of files) form.append("files", f, f.name);
    if (input.title) form.set("title", input.title);
    if (input.text) form.set("text", input.text);
    if (input.externalUrl) form.set("externalUrl", input.externalUrl);
    if (input.contentKind) form.set("contentKind", input.contentKind);
    return apiFetch<{ submission: AssignmentSubmission }>(`/student/assignments/${id}/submit`, {
      method: "POST",
      body: form,
    });
  },
  studentMySubmission: (id: string) =>
    apiFetch<{ submission: AssignmentSubmission }>(`/student/assignments/${id}/my`),
};

export const studentApi = {
  getDashboard: () => apiFetch<StudentDashboardData>("/student/dashboard"),
  getLeaderboard: () => apiFetch<StudentLeaderboardResponse>("/student/leaderboard"),
  getProfile: () => apiFetch<StudentProfileData>("/student/profile"),
  updateProfile: (input: UpdateStudentProfileInput) =>
    apiFetch<StudentProfileData>("/student/profile", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  getBadges: () => apiFetch<{ badges: StudentBadge[] }>("/student/badges"),
  generateAnimation: (input: GenerateAnimationInput) =>
    apiFetch<{ animation: StudentAnimation }>("/student/animations/generate", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listAnimations: () =>
    apiFetch<{ items: StudentAnimation[] }>("/student/animations"),
  getAnimation: (id: string) =>
    apiFetch<{ animation: StudentAnimation }>(`/student/animations/${id}`),
  uploadAnimationVideo: (
    id: string,
    videoBlob: Blob,
    filename = "animation.webm",
    thumbnailBlob?: Blob,
    thumbnailFilename = "poster.jpg",
  ) => {
    const formData = new FormData();
    formData.append("video", videoBlob, filename);
    if (thumbnailBlob) formData.append("thumbnail", thumbnailBlob, thumbnailFilename);
    return apiFetch<{ animation: StudentAnimation }>(`/student/animations/${id}/video`, {
      method: "POST",
      body: formData,
    });
  },
  failAnimation: (id: string, error: string) =>
    apiFetch<{ animation: StudentAnimation }>(`/student/animations/${id}/fail`, {
      method: "POST",
      body: JSON.stringify({ error }),
    }),
  /** Narration voiceover MP3 bytes (throws ApiError with provider message on failure). */
  fetchNarrationAudio: async (text: string): Promise<Blob> => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let res = await fetch(`${API_BASE}/student/animations/narration`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ text }),
    });
    if (res.status === 401 && token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers.set("Authorization", `Bearer ${refreshed}`);
        res = await fetch(`${API_BASE}/student/animations/narration`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ text }),
        });
      }
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      const error = body?.error ?? { code: "UNKNOWN", message: `Request failed with status ${res.status}` };
      throw new ApiError(res.status, error);
    }
    return res.blob();
  },
  deleteAnimation: (id: string) =>
    apiFetch<{ success: boolean }>(`/student/animations/${id}`, {
      method: "DELETE",
    }),
};


