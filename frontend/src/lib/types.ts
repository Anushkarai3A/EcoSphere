export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export type UserStatus =
  | "PENDING_ADMIN_APPROVAL"
  | "PENDING_TEACHER_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type TeacherVerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

/** Mirrors the backend SafeUser shape (backend/src/services/auth.service.ts). */
export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  schoolId: string | null;
  school: { id: string; name: string } | null;
  createdAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  teacherProfile: {
    id: string;
    schoolId: string | null;
    department: string | null;
    employeeId: string | null;
    teacherId: string | null;
    designation: string | null;
    verificationStatus: TeacherVerificationStatus | null;
    verifiedAt: string | null;
    school: { id: string; name: string } | null;
  } | null;
  studentProfile: {
    id: string;
    streakCount: number;
    usn: string | null;
    semester: string | null;
    department: string | null;
    school: { id: string; name: string } | null;
  } | null;
}

export interface AuthSession {
  user: SafeUser;
  accessToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterStudentInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  consent: true;
  schoolId: string; // REQUIRED for institution isolation
  usn?: string;
  semester?: string;
  department?: string;
  phone?: string;
}

export interface RegisterTeacherInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  consent: true;
  schoolId: string; // REQUIRED for institution isolation
  department?: string;
  employeeId?: string;
  phone?: string;
}

export interface Institution {
  id: string;
  name: string;
  city: string | null;
  country: string;
}

export type QuestCategory =
  | "TREE_PLANTATION"
  | "WASTE_COLLECTION"
  | "PARK_CLEANING"
  | "RECYCLING"
  | "BIODIVERSITY"
  | "AWARENESS"
  | "OTHER";

export type QuestDifficulty = "EASY" | "MEDIUM" | "HARD" | "EXPERT";

export type QuestStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "ARCHIVED";

export type ProofType = "PHOTO" | "VIDEO" | "PHOTO_AND_VIDEO";

export type AcceptanceStatus = "ACCEPTED" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED";

export type SubmissionStatus =
  | "PENDING_VERIFICATION"
  | "PENDING_MANUAL_REVIEW"
  | "AUTO_APPROVED"
  | "AUTO_REJECTED"
  | "APPROVED"
  | "REJECTED";

export type AssetType = "IMAGE" | "VIDEO";

export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type Recommendation = "APPROVE" | "REJECT" | "NEEDS_MANUAL_REVIEW";

export type FraudRisk = "LOW" | "MEDIUM" | "HIGH";

export type CheckStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

export type VerificationCheckType =
  | "GPS_PROXIMITY"
  | "TIMESTAMP_FRESHNESS"
  | "EXIF_METADATA"
  | "EXIF_GPS_CONSISTENCY"
  | "IMAGE_SIMILARITY"
  | "OBJECT_DETECTION"
  | "SCENE_CLASSIFICATION"
  | "DUPLICATE_DETECTION"
  | "IMAGE_QUALITY"
  | "DEVICE_SPOOFING";

export type XpValue = string | number;

/** Mirrors the backend quest detail shape (backend/src/services/quest.service.ts). */
export interface Quest {
  id: string;
  teacherId: string;
  classGroupId: string | null;
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  xpReward: XpValue;
  addressText: string | null;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  maxParticipants: number | null;
  requiredProofType: ProofType;
  minPhotoCount: number;
  policyId: string | null;
  status: QuestStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  lat?: number | null;
  lng?: number | null;
  teacher: { id: string; firstName: string; lastName: string };
  classGroup: { id: string; name: string } | null;
  _count: { acceptances: number };
}

export interface NearbyQuest {
  id: string;
  teacherId?: string | null;
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  xpReward: number;
  radiusMeters: number;
  requiredProofType: ProofType;
  minPhotoCount: number;
  addressText: string | null;
  startsAt: string;
  endsAt: string;
  distanceMeters: number;
  lat: number;
  lng: number;
}

export interface CreateQuestInput {
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  xpReward: number;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  addressText?: string;
  maxParticipants?: number;
  requiredProofType: ProofType;
  minPhotoCount: number;
  lat?: number;
  lng?: number;
  publish?: boolean;
}

export interface UpdateQuestInput {
  title?: string;
  description?: string;
  category?: QuestCategory;
  difficulty?: QuestDifficulty;
  xpReward?: number;
  radiusMeters?: number;
  startsAt?: string;
  endsAt?: string;
  addressText?: string;
  maxParticipants?: number;
  requiredProofType?: ProofType;
  minPhotoCount?: number;
  lat?: number;
  lng?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuestSummary {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  xpReward: XpValue;
  addressText: string | null;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  requiredProofType: ProofType;
  minPhotoCount: number;
}

export interface MyAcceptance {
  id: string;
  status: AcceptanceStatus;
  acceptedAt: string;
  completedAt: string | null;
  xpAwarded: string;
  quest: QuestSummary;
  latestSubmission: {
    id: string;
    status: SubmissionStatus;
    submittedAt: string;
    reviewNote: string | null;
  } | null;
}

export interface EvidenceAsset {
  id: string;
  assetType: AssetType;
  cloudinaryPublicId: string;
  secureUrl: string;
  mimeType: string;
  sizeBytes: string;
}

export interface VerificationCheck {
  id: string;
  checkType: VerificationCheckType;
  status: CheckStatus;
  score: string | null;
  confidence: string | null;
  message: string | null;
  details: Record<string, unknown> | null;
}

export interface VerificationRun {
  id: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  overallRecommendation: Recommendation | null;
  overallConfidence: string | null;
  fraudRisk: FraudRisk | null;
  summary: string | null;
  aiServiceVersion: string | null;
  errorMessage: string | null;
  checks: VerificationCheck[];
}

export interface Submission {
  id: string;
  submittedAt: string;
  deviceTimestamp: string | null;
  locationAccuracyM: number | null;
  notes: string | null;
  status: SubmissionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  reSubmissionOf: string | null;
  createdAt: string;
  assets: EvidenceAsset[];
  verification: VerificationRun | null;
}

export interface AcceptanceDetail {
  id: string;
  status: AcceptanceStatus;
  acceptedAt: string;
  completedAt: string | null;
  xpAwarded: string;
  quest: QuestSummary;
  submissions: Submission[];
}

export interface SubmitEvidenceInput {
  lat: number;
  lng: number;
  accuracy?: number;
  deviceTimestamp?: string;
  notes?: string;
}

export interface ReviewQueueItem {
  id: string;
  status: SubmissionStatus;
  submittedAt: string;
  notes: string | null;
  reSubmissionOf: string | null;
  reviewNote: string | null;
  assets: EvidenceAsset[];
  verification: VerificationRun | null;
  student: { id: string; firstName: string; lastName: string; email: string };
  quest: {
    id: string;
    title: string;
    category: QuestCategory;
    xpReward: XpValue;
    addressText: string | null;
    radiusMeters: number;
    requiredProofType: ProofType;
    minPhotoCount: number;
  };
}

export interface ReviewDecisionInput {
  decision: "APPROVE" | "REJECT";
  bonusXp?: number;
  note?: string;
}

export type UserStatusFilter =
  | "PENDING_ADMIN_APPROVAL"
  | "PENDING_TEACHER_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  archivedAt: string | null;
  approvedByUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  teacherProfile: {
    id: string;
    schoolId: string | null;
    department: string | null;
    employeeId: string | null;
    phone: string | null;
    teacherId: string | null;
    designation: string | null;
    verificationStatus: TeacherVerificationStatus | null;
    verifiedAt: string | null;
    school: { id: string; name: string; country: string } | null;
  } | null;
  studentProfile: {
    id: string;
    schoolId: string | null;
    department: string | null;
    usn: string | null;
    semester: string | null;
    phone: string | null;
    school: { id: string; name: string; country: string } | null;
  } | null;
}

export interface TeacherProfile {
  id: string;
  schoolId: string | null;
  phone: string | null;
  bio: string | null;
  department: string | null;
  employeeId: string | null;
  teacherId: string | null;
  designation: string | null;
  verificationStatus: TeacherVerificationStatus;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
  school: { id: string; name: string } | null;
}

export interface TeacherProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  schoolId: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  school: { id: string; name: string } | null;
  teacherProfile: TeacherProfile | null;
}

export interface UpdateTeacherProfileInput {
  phone?: string;
  bio?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
}

export interface InstitutionInvitation {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  creator: { id: string; firstName: string; lastName: string };
}

export interface PaginatedInvitations {
  items: InstitutionInvitation[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Assignments System (Full-featured Assignment Management)
// ---------------------------------------------------------------------------

export type AssignmentType =
  | "INDIVIDUAL"
  | "PROJECT"
  | "WRITTEN"
  | "RESEARCH"
  | "ENVIRONMENTAL_ACTIVITY"
  | "PRESENTATION"
  | "REPORT"
  | "FILE_SUBMISSION"
  | "OTHER";

export type AssignmentStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CLOSED" | "ARCHIVED";

export type SubmissionType =
  | "TEXT"
  | "PDF"
  | "DOCUMENT"
  | "PRESENTATION"
  | "IMAGE"
  | "VIDEO"
  | "MULTIPLE_FILES"
  | "URL"
  | "TEXT_AND_FILE";

export type GradingType = "MARKS" | "PERCENTAGE" | "PASS_FAIL";

export type StudentAssignmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "LATE"
  | "GRADED"
  | "RETURNED"
  | "RESUBMISSION_REQUIRED"
  | "OVERDUE";

export interface RubricCriterion {
  criterion: string;
  maxMarks: number;
  description?: string;
}

export interface AssignmentRecipient {
  id: string;
  assignmentId: string;
  studentId: string;
  assignedAt: string;
  student?: { id: string; firstName: string; lastName: string; email: string };
}

export interface Assignment {
  id: string;
  teacherId: string;
  schoolId: string | null;
  classGroupId: string | null;
  targetType: "CLASS" | "STUDENTS";
  title: string;
  description: string;
  subject: string | null;
  type: AssignmentType;
  topic: QuestCategory;
  difficulty: QuestDifficulty;
  xpReward: XpValue;
  startAt: string;
  dueAt: string;
  allowLate: boolean;
  lateDeadline: string | null;
  submissionType: SubmissionType;
  allowedFormats: string[] | null;
  maxFileSizeMb: number;
  maxFiles: number;
  maxMarks: number;
  passMarks: number | null;
  gradingType: GradingType;
  allowResubmission: boolean;
  maxAttempts: number;
  teacherFeedbackEnabled: boolean;
  rubric: RubricCriterion[] | null;
  badgeId: string | null;
  category: string | null;
  relatedQuestId: string | null;
  status: AssignmentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  teacher: { id: string; firstName: string; lastName: string };
  school?: { id: string; name: string } | null;
  classGroup: { id: string; name: string } | null;
  materials: StudyMaterial[];
  recipients?: AssignmentRecipient[];
  submissions?: AssignmentSubmission[];
  _count?: { submissions: number; recipients: number };
  mySubmission?: AssignmentSubmission | null;
  calculatedStatus?: StudentAssignmentStatus;
}

export interface AssignmentAsset {
  id: string;
  submissionId: string;
  kind: string;
  url: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  uploadedAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  attempt: number;
  contentKind: string;
  title: string | null;
  text: string | null;
  externalUrl: string | null;
  submittedAt: string;
  submissionStatus: "ON_TIME" | "LATE";
  gradeStatus: "UNGRADED" | "GRADED" | "RETURNED";
  score: number | null;
  gradeNotes: string | null;
  aiFeedback: string | null;
  xpAwarded: string;
  gradedBy: string | null;
  gradedAt: string | null;
  resubmissionOf: string | null;
  student?: { id: string; firstName: string; lastName: string; email: string };
  grader?: { id: string; firstName: string; lastName: string } | null;
  assignment?: { id: string; title: string; dueAt: string; maxMarks: number; xpReward: XpValue };
  assets: AssignmentAsset[];
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  subject?: string;
  type?: AssignmentType;
  topic?: QuestCategory;
  difficulty?: QuestDifficulty;
  xpReward?: number;
  startAt?: string;
  dueAt: string;
  allowLate?: boolean;
  lateDeadline?: string;
  submissionType?: SubmissionType;
  allowedFormats?: string[];
  maxFileSizeMb?: number;
  maxFiles?: number;
  maxMarks?: number;
  passMarks?: number;
  gradingType?: GradingType;
  allowResubmission?: boolean;
  maxAttempts?: number;
  teacherFeedbackEnabled?: boolean;
  rubric?: RubricCriterion[];
  badgeId?: string;
  category?: string;
  relatedQuestId?: string;
  classGroupId?: string | null;
  targetType?: "CLASS" | "STUDENTS";
  specificStudentIds?: string[];
  publish?: boolean;
}

export interface UpdateAssignmentInput extends Partial<CreateAssignmentInput> {}

export interface GradeAssignmentSubmissionInput {
  score: number;
  gradeNotes?: string;
  returnForResubmission?: boolean;
}

export interface SubmitAssignmentInput {
  title?: string;
  text?: string;
  externalUrl?: string;
  contentKind?: string;
}

// ---------------------------------------------------------------------------
// AI Quiz Studio (backend /quizzes, /student/quizzes)
// ---------------------------------------------------------------------------

export type QuizStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type QuizQuestionType = "MCQ" | "TRUE_FALSE" | "MATCH" | "SCENARIO" | "CASE_STUDY";

export interface QuizOption {
  text: string;
}

export interface QuizQuestionTeacher {
  id: string;
  position: number;
  prompt: string;
  options: QuizOption[];
  correctIndex: number;
  explanation: string | null;
  qType: string | null;
  aiGenerated: boolean;
  reviewState: string | null;
}

export interface QuizQuestionStudent {
  id: string;
  position: number;
  prompt: string;
  options: QuizOption[];
  qType: string | null;
  explanation: string | null;
}

export interface Quiz {
  id: string;
  teacherId: string;
  materialId: string | null;
  classGroupId: string | null;
  title: string;
  description: string | null;
  topic: string;
  difficulty: QuestDifficulty;
  status: QuizStatus;
  passThreshold: number | null;
  timeLimitMin: number | null;
  questionCount: number;
  sourceRunId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  teacher: { id: string; firstName: string; lastName: string };
  material: { id: string; title: string; kind: string } | null;
  classGroup: { id: string; name: string } | null;
  _count: { attempts: number };
  questions?: QuizQuestionTeacher[];
}

export interface GenerateQuizInput {
  title: string;
  description?: string;
  materialId?: string;
  topic?: string;
  difficulty?: QuestDifficulty;
  count?: number;
  passThreshold?: number;
  timeLimitMin?: number;
  publish?: boolean;
}

export interface StudyMaterial {
  id: string;
  teacherId: string;
  assignmentId: string | null;
  kind: string;
  title: string;
  filename: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  notes: string | null;
  uploadedAt: string;
}

export interface QuizAttemptSummary {
  id: string;
  score: number;
  maxScore: number;
  passed: boolean;
  submittedAt: string;
}

export interface StudentQuiz {
  id: string;
  teacherId: string;
  materialId: string | null;
  classGroupId: string | null;
  title: string;
  description: string | null;
  topic: string;
  difficulty: QuestDifficulty;
  questionCount: number;
  timeLimitMin: number | null;
  teacher: { id: string; firstName: string; lastName: string };
  material: { id: string; title: string } | null;
  classGroup: { id: string; name: string } | null;
  myAttempt: QuizAttemptSummary | null;
}

export interface StudentQuizDetail {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  difficulty: QuestDifficulty;
  questionCount: number;
  passThreshold: number | null;
  timeLimitMin: number | null;
  teacher: { id: string; firstName: string; lastName: string };
  material: { id: string; title: string } | null;
  questions: QuizQuestionStudent[];
  myAttempt: QuizAttemptSummary | null;
}

export interface QuizAnswerInput {
  questionId: string;
  selectedIndex: number;
}

export interface QuizResultItem {
  questionId: string;
  prompt: string;
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  explanation: string | null;
}

export interface QuizAttemptResult {
  attempt: QuizAttemptSummary;
  results: QuizResultItem[];
}

export interface StudentDashboardStudent {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  schoolName: string;
  schoolCity: string;
  department: string;
  semester: string;
  grade: string;
  usn: string;
  phone: string;
  streakCount: number;
  privacyMode: boolean;
}

export interface StudentDashboardMetrics {
  totalXp: number;
  level: number;
  levelProgress: number;
  levelTarget: number;
  leaderboardRank: number;
  totalStudentsInSchool: number;
  activeQuestsCount: number;
  submittedQuestsCount: number;
  completedQuestsCount: number;
  pendingAssignmentsCount: number;
  completedAssignmentsCount: number;
  availableQuizzesCount: number;
  completedQuizzesCount: number;
  averageQuizScore: number;
  badgeCount: number;
}

export interface StudentBadge {
  id: string;
  key: string;
  name: string;
  description: string;
  iconUrl: string;
  earnedAt?: string;
  xpBonus?: number;
  isEarned?: boolean;
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  subject: string | null;
  dueAt: string;
  maxMarks: number;
  xpReward: number;
  type: string;
}

export interface AvailableQuizSummary {
  id: string;
  title: string;
  topic: string;
  difficulty: QuestDifficulty;
  questionCount: number;
  timeLimitMin: number | null;
  teacherName: string;
}

export interface RecentActivityItem {
  id: string;
  type: "QUEST_COMPLETED" | "ASSIGNMENT_SUBMITTED" | "ASSIGNMENT_GRADED" | "QUIZ_PASSED" | "BADGE_EARNED" | "XP_EARNED";
  title: string;
  description: string;
  xp: number;
  timestamp: string;
}

export interface StudentDashboardData {
  student: StudentDashboardStudent;
  metrics: StudentDashboardMetrics;
  badges: StudentBadge[];
  upcomingDeadlines: UpcomingDeadline[];
  availableQuizzes: AvailableQuizSummary[];
  recentActivity: RecentActivityItem[];
}

export interface LeaderboardItem {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  department: string | null;
  semester: string | null;
  totalXp: number;
  level: number;
  badgeCount: number;
  isMe: boolean;
  rank: number;
}

export interface StudentLeaderboardResponse {
  items: LeaderboardItem[];
  totalCount: number;
  myRank: number;
  myTotalXp: number;
}

export interface StudentProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  schoolId: string | null;
  createdAt: string;
  school: { id: string; name: string; city: string | null; state: string | null; country: string } | null;
  studentProfile: {
    id: string;
    usn: string | null;
    semester: string | null;
    grade: string | null;
    department: string | null;
    phone: string | null;
    streakCount: number;
    privacyMode: boolean;
    updatedAt: string;
  } | null;
  enrollments: Array<{
    id: string;
    classGroup: {
      id: string;
      name: string;
      teacher: { firstName: string; lastName: string };
    };
  }>;
  userBadges: Array<{
    id: string;
    earnedAt: string;
    badge: StudentBadge;
  }>;
}

export interface UpdateStudentProfileInput {
  phone?: string;
  department?: string;
  semester?: string;
  grade?: string;
  usn?: string;
  privacyMode?: boolean;
}

export interface AnimationElement {
  type: string;
  x: number;
  y: number;
  scale?: number;
  color?: string | null;
  motion?: string;
  label?: string | null;
  /** Growth range 0..1 across the scene (sapling time-lapse). */
  g0?: number;
  g1?: number;
}

export type SceneCamera = "wide" | "follow" | "closeup" | "medium" | "up" | "static";

export interface AnimationScene {
  sceneNumber?: number;
  scene_number?: number;
  duration: number;
  title?: string;
  visualDescription?: string;
  dialogue?: string;
  characterAction?: string;
  keyTakeaway?: string;
  background_top?: string;
  background_bottom?: string;
  narration?: string;
  elements?: AnimationElement[];
  educational_point?: string;
  camera?: SceneCamera | string;
  transition?: string;
  /** Story-film mode: beat row of the named film (frontend owns choreography). */
  film?: string;
  beat_index?: number;
}

export interface StudentAnimation {
  id: string;
  studentId: string;
  prompt: string;
  topic: string | null;
  style: string | null;
  durationSeconds: number;
  scenes: AnimationScene[];
  status: "QUEUED" | "GENERATING" | "RENDERING" | "READY" | "FAILED" | "COMPLETED" | string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  provider?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface GenerateAnimationInput {
  prompt: string;
  topic?: string;
  durationSeconds?: number;
  style?: "CARTOON_2D" | "MOTION_GRAPHICS" | "ECO_DOODLE" | "PIXEL_ART" | "INFOGRAPHIC";
  characters?: string[];
  scenes?: string[];
  educationalContent?: string;
}

