import { Prisma } from "@prisma/client";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { generateFilmDirection, synthesizeNarrationAudio } from "../lib/aiGateway.js";
import { assetUrl } from "../lib/upload.js";
import type { GenerateAnimationInput, UpdateStudentProfileInput } from "../validators/student.validators.js";

/** XP curve: Reaching level n+1 from level n costs 100 × n XP */
export function calculateLevel(xp: number): { level: number; levelProgress: number; levelTarget: number } {
  const safeXp = Math.max(0, xp);
  const n = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * safeXp) / 100)) / 2));
  const currentFloor = (100 * n * (n - 1)) / 2;
  const nextFloor = (100 * (n + 1) * n) / 2;
  return {
    level: n,
    levelProgress: safeXp - currentFloor,
    levelTarget: Math.max(1, nextFloor - currentFloor),
  };
}

/** Default Eco Badges definition */
const DEFAULT_BADGES = [
  {
    key: "FIRST_QUEST",
    name: "Eco Explorer",
    description: "Completed your first environmental quest in the real world.",
    iconUrl: "compass",
    category: "QUEST_COUNT" as const,
    criteriaType: "QUEST_COUNT" as const,
    criteriaValue: { count: 1 },
    xpBonus: BigInt(50),
  },
  {
    key: "XP_CENTURION",
    name: "Centurion Scout",
    description: "Earned your first 100 XP from eco-activities and coursework.",
    iconUrl: "zap",
    category: "XP" as const,
    criteriaType: "XP_THRESHOLD" as const,
    criteriaValue: { threshold: 100 },
    xpBonus: BigInt(25),
  },
  {
    key: "QUIZ_WHIZ",
    name: "Eco Scholar",
    description: "Passed an environmental knowledge quiz with distinction.",
    iconUrl: "sparkles",
    category: "SPECIAL" as const,
    criteriaType: "MANUAL" as const,
    criteriaValue: { type: "quiz_pass" },
    xpBonus: BigInt(30),
  },
  {
    key: "ASSIGNMENT_ACE",
    name: "Dedicated Learner",
    description: "Submitted an assignment reviewed and graded by your teacher.",
    iconUrl: "file-check",
    category: "SPECIAL" as const,
    criteriaType: "MANUAL" as const,
    criteriaValue: { type: "assignment_graded" },
    xpBonus: BigInt(40),
  },
  {
    key: "EARTH_CHAMPION",
    name: "Earth Guardian",
    description: "Accumulated 500 XP fighting pollution and advancing sustainability.",
    iconUrl: "shield-check",
    category: "XP" as const,
    criteriaType: "XP_THRESHOLD" as const,
    criteriaValue: { threshold: 500 },
    xpBonus: BigInt(100),
  },
];

/** Ensures initial badge catalogue exists */
async function ensureDefaultBadges() {
  for (const b of DEFAULT_BADGES) {
    await prisma.badge.upsert({
      where: { key: b.key },
      update: {},
      create: {
        key: b.key,
        name: b.name,
        description: b.description,
        iconUrl: b.iconUrl,
        category: b.category,
        criteriaType: b.criteriaType,
        criteriaValue: b.criteriaValue,
        xpBonus: b.xpBonus,
        isActive: true,
      },
    });
  }
}

/** Check and unlock any badges earned by the student */
async function checkAndAwardBadges(studentId: string, totalXp: number, completedQuests: number, passedQuizzes: number, gradedAssignments: number) {
  try {
    await ensureDefaultBadges();
    const existingBadges = await prisma.userBadge.findMany({
      where: { userId: studentId },
      select: { badge: { select: { key: true } } },
    });
    const earnedKeys = new Set(existingBadges.map((ub) => ub.badge.key));

    const toAward: string[] = [];
    if (completedQuests >= 1 && !earnedKeys.has("FIRST_QUEST")) toAward.push("FIRST_QUEST");
    if (totalXp >= 100 && !earnedKeys.has("XP_CENTURION")) toAward.push("XP_CENTURION");
    if (passedQuizzes >= 1 && !earnedKeys.has("QUIZ_WHIZ")) toAward.push("QUIZ_WHIZ");
    if (gradedAssignments >= 1 && !earnedKeys.has("ASSIGNMENT_ACE")) toAward.push("ASSIGNMENT_ACE");
    if (totalXp >= 500 && !earnedKeys.has("EARTH_CHAMPION")) toAward.push("EARTH_CHAMPION");

    for (const key of toAward) {
      const badge = await prisma.badge.findUnique({ where: { key } });
      if (badge) {
        await prisma.userBadge.create({
          data: {
            userId: studentId,
            badgeId: badge.id,
          },
        });
      }
    }
  } catch {
    /* non-blocking badge evaluation */
  }
}

// ---------------------------------------------------------------------------
// Student Dashboard Aggregation
// ---------------------------------------------------------------------------

export async function getStudentDashboardData(studentId: string, schoolId: string) {
  // 1. Fetch User & Profile
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      role: true,
      status: true,
      schoolId: true,
      school: { select: { id: true, name: true, city: true } },
      studentProfile: {
        select: {
          id: true,
          usn: true,
          semester: true,
          grade: true,
          department: true,
          phone: true,
          streakCount: true,
          privacyMode: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Student not found");
  }

  // 2. Fetch Enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classGroupId: true, classGroup: { select: { id: true, name: true } } },
  });
  const classIds = enrollments.map((e) => e.classGroupId);

  // 3. Compute real XP from transactions
  const xpTransactions = await prisma.xpTransaction.findMany({
    where: { userId: studentId },
    select: { id: true, amount: true, sourceType: true, balanceAfter: true, note: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const totalXp = xpTransactions.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const { level, levelProgress, levelTarget } = calculateLevel(totalXp);

  // 4. Quest metrics
  const acceptances = await prisma.questAcceptance.findMany({
    where: { studentId },
    include: {
      quest: {
        select: { id: true, title: true, xpReward: true, category: true, difficulty: true },
      },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });

  const activeQuestsCount = acceptances.filter((a) => a.status === "ACCEPTED" || a.status === "IN_PROGRESS").length;
  const submittedQuestsCount = acceptances.filter((a) => a.status === "SUBMITTED").length;
  const completedQuestsCount = acceptances.filter((a) => a.status === "APPROVED").length;

  // 5. Assignments
  const recipientAssignments = await prisma.assignmentRecipient.findMany({
    where: { studentId },
    select: { assignmentId: true },
  });
  const recipientAssignmentIds = recipientAssignments.map((r) => r.assignmentId);

  const publishedAssignments = await prisma.assignment.findMany({
    where: {
      status: "PUBLISHED",
      schoolId,
      archivedAt: null,
      OR: [
        { targetType: "CLASS", OR: [{ classGroupId: null }, ...(classIds.length > 0 ? [{ classGroupId: { in: classIds } }] : [])] },
        ...(recipientAssignmentIds.length > 0 ? [{ id: { in: recipientAssignmentIds } }] : []),
      ],
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      submissions: {
        where: { studentId },
        orderBy: { attempt: "desc" },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  let completedAssignmentsCount = 0;
  let gradedAssignmentsCount = 0;
  const pendingAssignments: typeof publishedAssignments = [];

  for (const a of publishedAssignments) {
    const latestSub = a.submissions[0];
    if (latestSub) {
      if (latestSub.gradeStatus === "GRADED") {
        completedAssignmentsCount += 1;
        gradedAssignmentsCount += 1;
      } else if (latestSub.gradeStatus === "RETURNED") {
        pendingAssignments.push(a);
      } else {
        completedAssignmentsCount += 1; // submitted awaiting grade
      }
    } else {
      pendingAssignments.push(a);
    }
  }

  // 6. Quizzes
  const publishedQuizzes = await prisma.quiz.findMany({
    where: {
      status: "PUBLISHED",
      teacher: { schoolId },
      OR: [{ classGroupId: null }, ...(classIds.length > 0 ? [{ classGroupId: { in: classIds } }] : [])],
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      attempts: {
        where: { studentId },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { studentId },
    select: { score: true, maxScore: true, passed: true },
  });

  const completedQuizzesCount = quizAttempts.filter((qa) => qa.passed).length;
  const averageQuizScore =
    quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((acc, cur) => acc + (cur.maxScore > 0 ? (cur.score / cur.maxScore) * 100 : 0), 0) / quizAttempts.length)
      : 0;

  const availableQuizzes = publishedQuizzes.filter((q) => {
    const passedAttempt = q.attempts.find((att) => att.passed);
    return !passedAttempt;
  });

  // 7. Badges
  await checkAndAwardBadges(studentId, totalXp, completedQuestsCount, completedQuizzesCount, gradedAssignmentsCount);

  const userBadges = await prisma.userBadge.findMany({
    where: { userId: studentId },
    include: { badge: true },
    orderBy: { earnedAt: "desc" },
  });

  // 8. Calculate Leaderboard Rank in School
  const schoolStudents = await prisma.user.findMany({
    where: { schoolId, role: "STUDENT", status: "APPROVED" },
    select: {
      id: true,
      xpTransactions: { select: { amount: true } },
    },
  });

  const ranked = schoolStudents
    .map((s) => ({
      id: s.id,
      totalXp: s.xpTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
    }))
    .sort((a, b) => b.totalXp - a.totalXp);

  const rankIndex = ranked.findIndex((s) => s.id === studentId);
  const leaderboardRank = rankIndex >= 0 ? rankIndex + 1 : ranked.length + 1;

  // 9. Recent Activity Feed
  type ActivityItem = {
    id: string;
    type: "QUEST_COMPLETED" | "ASSIGNMENT_SUBMITTED" | "ASSIGNMENT_GRADED" | "QUIZ_PASSED" | "BADGE_EARNED" | "XP_EARNED";
    title: string;
    description: string;
    xp: number;
    timestamp: Date;
  };

  const activityFeed: ActivityItem[] = [];

  // Completed quests
  for (const acc of acceptances) {
    if (acc.status === "APPROVED" && acc.completedAt) {
      activityFeed.push({
        id: `quest-${acc.id}`,
        type: "QUEST_COMPLETED",
        title: "Quest Completed",
        description: `Verified and earned XP for "${acc.quest?.title ?? "Environmental Quest"}"`,
        xp: Number(acc.xpAwarded),
        timestamp: acc.completedAt,
      });
    }
  }

  // Assignment submissions / grades
  for (const a of publishedAssignments) {
    for (const s of a.submissions) {
      if (s.gradeStatus === "GRADED" && s.gradedAt) {
        activityFeed.push({
          id: `grade-${s.id}`,
          type: "ASSIGNMENT_GRADED",
          title: "Assignment Graded",
          description: `Scored ${s.score}/${a.maxMarks} on "${a.title}"`,
          xp: Number(s.xpAwarded),
          timestamp: s.gradedAt,
        });
      } else {
        activityFeed.push({
          id: `sub-${s.id}`,
          type: "ASSIGNMENT_SUBMITTED",
          title: "Assignment Submitted",
          description: `Submitted attempt #${s.attempt} for "${a.title}"`,
          xp: 0,
          timestamp: s.submittedAt,
        });
      }
    }
  }

  // Quiz passes
  for (const q of publishedQuizzes) {
    for (const att of q.attempts) {
      if (att.passed) {
        activityFeed.push({
          id: `quiz-${att.id}`,
          type: "QUIZ_PASSED",
          title: "Quiz Passed",
          description: `Scored ${att.score}/${att.maxScore} on "${q.title}"`,
          xp: 10,
          timestamp: att.submittedAt,
        });
      }
    }
  }

  // Badges
  for (const ub of userBadges) {
    activityFeed.push({
      id: `badge-${ub.id}`,
      type: "BADGE_EARNED",
      title: "Badge Unlocked",
      description: `Earned "${ub.badge.name}" — ${ub.badge.description}`,
      xp: Number(ub.badge.xpBonus),
      timestamp: ub.earnedAt,
    });
  }

  activityFeed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Deadlines due soon
  const now = new Date();
  const upcomingDeadlines = publishedAssignments
    .filter((a) => {
      const isDueSoon = a.dueAt > now;
      const latest = a.submissions[0];
      const needsAction = !latest || latest.gradeStatus === "RETURNED";
      return isDueSoon && needsAction;
    })
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      dueAt: a.dueAt,
      maxMarks: a.maxMarks,
      xpReward: Number(a.xpReward),
      type: a.type,
    }));

  return {
    student: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      schoolName: user.school?.name ?? "Ecosphere Institution",
      schoolCity: user.school?.city ?? "",
      department: user.studentProfile?.department ?? "",
      semester: user.studentProfile?.semester ?? "",
      grade: user.studentProfile?.grade ?? "",
      usn: user.studentProfile?.usn ?? "",
      phone: user.studentProfile?.phone ?? "",
      streakCount: user.studentProfile?.streakCount ?? 0,
      privacyMode: user.studentProfile?.privacyMode ?? false,
    },
    metrics: {
      totalXp,
      level,
      levelProgress,
      levelTarget,
      leaderboardRank,
      totalStudentsInSchool: schoolStudents.length,
      activeQuestsCount,
      submittedQuestsCount,
      completedQuestsCount,
      pendingAssignmentsCount: pendingAssignments.length,
      completedAssignmentsCount,
      availableQuizzesCount: availableQuizzes.length,
      completedQuizzesCount,
      averageQuizScore,
      badgeCount: userBadges.length,
    },
    badges: userBadges.map((ub) => ({
      id: ub.badge.id,
      key: ub.badge.key,
      name: ub.badge.name,
      description: ub.badge.description,
      iconUrl: ub.badge.iconUrl,
      earnedAt: ub.earnedAt,
    })),
    upcomingDeadlines,
    availableQuizzes: availableQuizzes.slice(0, 5).map((q) => ({
      id: q.id,
      title: q.title,
      topic: q.topic,
      difficulty: q.difficulty,
      questionCount: q.questionCount,
      timeLimitMin: q.timeLimitMin,
      teacherName: `${q.teacher.firstName} ${q.teacher.lastName}`,
    })),
    recentActivity: activityFeed.slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Institution Leaderboard
// ---------------------------------------------------------------------------

export async function getInstitutionLeaderboard(currentStudentId: string, schoolId: string) {
  // Query only approved students belonging to the same institution
  const students = await prisma.user.findMany({
    where: {
      schoolId,
      role: "STUDENT",
      status: "APPROVED",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      studentProfile: {
        select: {
          department: true,
          semester: true,
          grade: true,
          privacyMode: true,
        },
      },
      xpTransactions: { select: { amount: true } },
      userBadges: { select: { id: true } },
    },
  });

  const formatted = students.map((s) => {
    const totalXp = s.xpTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const { level } = calculateLevel(totalXp);
    const isMe = s.id === currentStudentId;
    const isPrivate = s.studentProfile?.privacyMode && !isMe;

    return {
      id: s.id,
      name: isPrivate ? "Anonymous Eco Scout" : `${s.firstName} ${s.lastName}`,
      firstName: isPrivate ? "Eco" : s.firstName,
      lastName: isPrivate ? "Scout" : s.lastName,
      department: s.studentProfile?.department ?? null,
      semester: s.studentProfile?.semester ?? null,
      totalXp,
      level,
      badgeCount: s.userBadges.length,
      isMe,
    };
  });

  formatted.sort((a, b) => b.totalXp - a.totalXp || b.badgeCount - a.badgeCount);

  const leaderboard = formatted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  const myEntry = leaderboard.find((item) => item.isMe);

  return {
    items: leaderboard,
    totalCount: leaderboard.length,
    myRank: myEntry?.rank ?? leaderboard.length,
    myTotalXp: myEntry?.totalXp ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Student Profile Management
// ---------------------------------------------------------------------------

export async function getStudentProfile(studentId: string) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      schoolId: true,
      createdAt: true,
      school: { select: { id: true, name: true, city: true, state: true, country: true } },
      studentProfile: {
        select: {
          id: true,
          usn: true,
          semester: true,
          grade: true,
          department: true,
          phone: true,
          streakCount: true,
          privacyMode: true,
          updatedAt: true,
        },
      },
      enrollments: {
        include: {
          classGroup: {
            select: { id: true, name: true, teacher: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      userBadges: {
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
      },
    },
  });

  if (!user) throw new AppError(404, "USER_NOT_FOUND", "Student not found");
  return user;
}

export async function updateStudentProfile(studentId: string, data: UpdateStudentProfileInput) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });

  if (!profile) {
    throw new AppError(404, "NO_PROFILE", "Student profile not found");
  }

  const updated = await prisma.studentProfile.update({
    where: { userId: studentId },
    data: {
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.department !== undefined && { department: data.department || null }),
      ...(data.semester !== undefined && { semester: data.semester || null }),
      ...(data.grade !== undefined && { grade: data.grade || null }),
      ...(data.usn !== undefined && { usn: data.usn || null }),
      ...(data.privacyMode !== undefined && { privacyMode: data.privacyMode }),
    },
  });

  await writeAudit({
    userId: studentId,
    action: "STUDENT.PROFILE_UPDATE",
    entityType: "StudentProfile",
    entityId: updated.id,
    ctx: { ipAddress: null, userAgent: null },
  });

  return getStudentProfile(studentId);
}

// ---------------------------------------------------------------------------
// Badges Catalogue
// ---------------------------------------------------------------------------

export async function getStudentBadges(studentId: string) {
  await ensureDefaultBadges();

  const allBadges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: { criteriaType: "asc" },
  });

  const earned = await prisma.userBadge.findMany({
    where: { userId: studentId },
    include: { badge: true },
  });

  const earnedMap = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));

  return {
    badges: allBadges.map((b) => ({
      id: b.id,
      key: b.key,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      category: b.category,
      xpBonus: Number(b.xpBonus),
      isEarned: earnedMap.has(b.id),
      earnedAt: earnedMap.get(b.id) ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// AI Animation Studio Service
// ---------------------------------------------------------------------------

/** Keywords that mark a prompt as environmental-education related. */
const ECO_KEYWORDS = [
  "environment", "environmental", "eco", "ecology", "ecological", "nature",
  "climate", "global warming", "greenhouse", "carbon", "emission",
  "tree", "forest", "plant", "sapling", "plantation", "deforestation", "afforestation",
  "wildlife", "animal", "bird", "tiger", "elephant", "biodiversity", "ecosystem",
  "habitat", "endangered", "conservation", "sanctuary",
  "water", "river", "ocean", "sea", "lake", "pond", "rain", "marine", "groundwater",
  "drought", "wetland", "coral",
  "plastic", "waste", "garbage", "litter", "recycle", "recycling", "compost",
  "landfill", "e-waste", "ewaste", "pollution", "pollutant", "smog", "cleanliness",
  "clean-up", "cleanup", "sanitation",
  "energy", "solar", "wind", "renewable", "sustainab", "biogas", "hydropower",
  "soil", "air", "ozone", "monsoon", "weather", "season",
  "national park", "reserve", "mangrove", "glacier", "desert",
];

/** Keywords that are clearly outside environmental education. */
const OFF_TOPIC_KEYWORDS = [
  "movie", "film", "bollywood", "hollywood", "anime", "cricket", "football",
  "ipl", "game", "gaming", "pubg", "free fire", "coding", "python", "java",
  "javascript", "maths", "mathematics", "algebra", "physics", "chemistry",
  "history", "geography exam", "politics", "election", "religion", "god",
  "stock market", "crypto", "bitcoin", "fashion", "makeup", "recipe", "cooking",
  "song", "music", "dance", "birthday", "wedding", "exam paper", "semiconductor",
];

type EcoBucket = "waste" | "forest" | "water" | "energy" | "wildlife" | "air" | "general";

function detectEcoBucket(text: string): EcoBucket {
  if (/(plastic|waste|garbage|litter|recycl|compost|landfill|e-?waste|clean-?up|sanitation)/.test(text)) return "waste";
  if (/(tree|forest|plant|sapling|deforest|afforest|mangrove)/.test(text)) return "forest";
  if (/(water|river|ocean|sea\b|lake|pond|rain|marine|groundwater|drought|wetland|coral)/.test(text)) return "water";
  if (/(solar|renewable|energy|biogas|wind|hydropower|sustainab)/.test(text)) return "energy";
  if (/(wildlife|animal|bird|tiger|elephant|biodiversity|ecosystem|habitat|endangered|bee)/.test(text)) return "wildlife";
  if (/(air|smog|aqi|ozone)/.test(text)) return "air";
  return "general";
}

/**
 * Scope gate: the studio serves environmental education ONLY.
 * Returns the detected topic bucket, or throws 403 for off-topic prompts.
 */
function assertEnvironmentalPrompt(prompt: string, topic?: string): EcoBucket {
  const text = `${prompt} ${topic ?? ""}`.toLowerCase();
  const ecoHit = ECO_KEYWORDS.some((k) => text.includes(k));
  const offTopicHit = OFF_TOPIC_KEYWORDS.some((k) => text.includes(k));
  if (!ecoHit || (offTopicHit && !ecoHit)) {
    throw new AppError(
      403,
      "ANIMATION_OFF_TOPIC",
      "The Animation Studio creates videos about environmental education only — like trees, wildlife, water, waste, energy, or climate. Please ask about an eco topic!",
    );
  }
  return detectEcoBucket(text);
}

interface SceneTemplate {
  title: string;
  visualDescription: string;
  dialogue: string;
  characterAction: string;
  keyTakeaway: string;
}

const ECO_SCENE_LIBRARY: Record<EcoBucket, { label: string; scenes: SceneTemplate[] }> = {
  waste: {
    label: "Waste & Plastic",
    scenes: [
      {
        title: "The Problem Arises",
        visualDescription: "A sunny town where single-use plastic and litter pile up near storm drains and parks.",
        dialogue: "Over 8 million tons of plastic enter our oceans each year — and it often starts in our neighborhoods.",
        characterAction: "A thoughtful student notices discarded bottles and traces their path toward the local canal.",
        keyTakeaway: "Uncollected neighborhood litter flows into waterways through stormwater runoff.",
      },
      {
        title: "The Science Behind It",
        visualDescription: "Animated cross-section of a landfill: plastics refusing to decompose over hundreds of years.",
        dialogue: "A plastic bottle can survive 450 years in a landfill while leaching microplastics into the soil.",
        characterAction: "A magnifying lens zooms into soil layers revealing glittering microplastic fragments.",
        keyTakeaway: "Most plastics never biodegrade — they fragment into persistent microplastics.",
      },
      {
        title: "The Journey to Waterways",
        visualDescription: "Rain pushes plastics through storm drains into a river heading for the coastline.",
        dialogue: "Rivers act as conveyor belts, carrying lightweight plastics straight to marine ecosystems.",
        characterAction: "Camera sweeps above the river delta as fish mistake microplastics for food.",
        keyTakeaway: "Rainwater carries buoyant plastics into rivers and ultimately ocean gyres.",
      },
      {
        title: "The Solution in Action",
        visualDescription: "Eco-warriors install trash booms, run riverside cleanups and recycling drives.",
        dialogue: "By switching to reusables and joining cleanup quests, we cut the problem at its root!",
        characterAction: "Characters sort collected plastics into color-coded bins and celebrate a clean shoreline.",
        keyTakeaway: "Source reduction and community collection intercept plastic before it harms marine life.",
      },
      {
        title: "Your Eco Pledge",
        visualDescription: "Sunrise over a clean park; pledge badges bloom like flowers across the screen.",
        dialogue: "Refuse, reduce, reuse, recycle — four small words that protect our rivers and seas.",
        characterAction: "The student pins a zero-waste pledge badge and invites friends to a cleanup quest.",
        keyTakeaway: "Every refused single-use item is one less pollutant in the ecosystem.",
      },
    ],
  },
  forest: {
    label: "Trees & Forests",
    scenes: [
      {
        title: "The Vanishing Green",
        visualDescription: "A lush forest edge where chainsaws and smoke steadily eat into the tree line.",
        dialogue: "The world loses nearly 10 million hectares of forest every year to deforestation.",
        characterAction: "A student counts tree stumps and marks them on a hand-drawn forest map.",
        keyTakeaway: "Deforestation fragments habitats and releases stored carbon into the atmosphere.",
      },
      {
        title: "The Science Behind It",
        visualDescription: "Animated photosynthesis: leaves drinking sunlight and exhaling oxygen molecules.",
        dialogue: "A single mature tree absorbs about 21 kilograms of carbon dioxide every year.",
        characterAction: "Sunbeams flow into leaf cells as oxygen bubbles float up into a blue sky.",
        keyTakeaway: "Trees are carbon-capture machines that also cool the air through transpiration.",
      },
      {
        title: "Roots That Hold Life",
        visualDescription: "Underground network of roots sheltering insects, fungi and burrowing animals.",
        dialogue: "One forest patch can shelter thousands of species — from hornbills to hidden mycelium webs.",
        characterAction: "Camera dives underground following root highways travelled by ants and earthworms.",
        keyTakeaway: "Forests are layered habitats; losing them collapses entire food webs.",
      },
      {
        title: "The Solution in Action",
        visualDescription: "Students dig pits, plant saplings and water them during a plantation drive.",
        dialogue: "Native saplings planted today become the forest canopy of the next generation!",
        characterAction: "Characters mulch, stake and geo-tag each sapling, then log it as an Ecosphere quest.",
        keyTakeaway: "Community plantation with native species restores canopy and biodiversity fastest.",
      },
      {
        title: "Your Eco Pledge",
        visualDescription: "Time-lapse of a sapling growing tall as seasons cycle around it.",
        dialogue: "Adopt a tree, protect a forest — guardians of green keep our planet breathing.",
        characterAction: "The student ties a care ribbon on their adopted sapling and schedules watering visits.",
        keyTakeaway: "Planted trees need aftercare; survival rate matters more than sapling count.",
      },
    ],
  },
  water: {
    label: "Water & Rivers",
    scenes: [
      {
        title: "Every Drop Counts",
        visualDescription: "A town tap dripping endlessly while a distant lake shrinks under a harsh sun.",
        dialogue: "Less than 1% of Earth's water is accessible freshwater — and much of it is polluted.",
        characterAction: "A student measures the leaking tap and calculates litres wasted every day.",
        keyTakeaway: "Freshwater is scarce; wastage and pollution shrink it further.",
      },
      {
        title: "The Science Behind It",
        visualDescription: "Animated water cycle: evaporation, clouds, rain, rivers returning to the sea.",
        dialogue: "The same water dinosaurs drank still cycles through our rivers, clouds and taps today.",
        characterAction: "Droplets ride the cycle loop as labels pop up: evaporate, condense, precipitate.",
        keyTakeaway: "The water cycle is closed — pollution dumped anywhere eventually returns.",
      },
      {
        title: "Rivers Under Stress",
        visualDescription: "A river choked with foam, sewage outlets and algal blooms spreading downstream.",
        dialogue: "Untreated sewage and farm runoff feed algal blooms that suffocate fish and river life.",
        characterAction: "A dissolved-oxygen meter plunges into the red as fish gasp near the surface.",
        keyTakeaway: "Nutrient pollution causes eutrophication, creating aquatic dead zones.",
      },
      {
        title: "The Solution in Action",
        visualDescription: "Rainwater harvesting tanks, check dams and lake-cleanup volunteers in action.",
        dialogue: "Harvest the rain, revive the lake — communities that recharge groundwater stay water-secure!",
        characterAction: "Characters desilt a lakebed, plant buffer reeds and install rooftop harvest pipes.",
        keyTakeaway: "Rainwater harvesting and lake revival directly recharge local groundwater.",
      },
      {
        title: "Your Eco Pledge",
        visualDescription: "A sparkling revived lake with kingfishers diving as children cycle past.",
        dialogue: "Fix the leak, save the lake — pledge five water-wise habits starting today.",
        characterAction: "The student signs a water pledge and maps campus taps for a fix-it drive.",
        keyTakeaway: "Household fixes and mindful use can cut daily water waste dramatically.",
      },
    ],
  },
  energy: {
    label: "Energy & Climate",
    scenes: [
      {
        title: "The Warming World",
        visualDescription: "Smokestacks and traffic fill the sky with a thickening grey greenhouse blanket.",
        dialogue: "Burning fossil fuels has raised global temperatures by over 1 degree Celsius already.",
        characterAction: "A thermometer climbs as the student logs smoke sources around the town.",
        keyTakeaway: "Greenhouse gases from fossil fuels trap heat and destabilize the climate.",
      },
      {
        title: "The Science Behind It",
        visualDescription: "Sunlight enters, infrared tries to escape but bounces off CO2 molecules.",
        dialogue: "Carbon dioxide lets sunshine in but blocks heat from escaping — like a planetary blanket.",
        characterAction: "Heat rays bounce between Earth and a glowing CO2 layer in slow motion.",
        keyTakeaway: "The greenhouse effect is natural; excess emissions make it dangerous.",
      },
      {
        title: "Power From the Sky",
        visualDescription: "Rooftop solar panels unfold, wind turbines spin over green hills.",
        dialogue: "One hour of sunlight hitting Earth carries more energy than humanity uses in a year.",
        characterAction: "Meters spin backwards as rooftops switch on solar and the grid turns green.",
        keyTakeaway: "Solar and wind are abundant, clean and increasingly the cheapest energy sources.",
      },
      {
        title: "The Solution in Action",
        visualDescription: "Students run an energy audit, swap bulbs for LEDs and cycle to school.",
        dialogue: "Efficiency first, renewables next — every saved watt is a watt never burned!",
        characterAction: "Characters stickerChart classroom energy use and celebrate a car-free school day.",
        keyTakeaway: "Saving energy and switching to renewables both shrink your carbon footprint.",
      },
      {
        title: "Your Eco Pledge",
        visualDescription: "A town glowing with clean energy under a clear blue sky.",
        dialogue: "Walk, cycle, switch off — small choices that cool the whole planet.",
        characterAction: "The student takes a low-carbon pledge and challenges friends to an eco-week.",
        keyTakeaway: "Daily transport and power choices are the biggest levers a student controls.",
      },
    ],
  },
  wildlife: {
    label: "Wildlife & Biodiversity",
    scenes: [
      {
        title: "Vanishing Neighbours",
        visualDescription: "Empty nests, silent forests and a tiger's footprints fading from the mud.",
        dialogue: "Wildlife populations have fallen by nearly 70% in just fifty years.",
        characterAction: "A student finds an abandoned nest and records it in a biodiversity diary.",
        keyTakeaway: "Habitat loss and poaching are emptying forests of their iconic species.",
      },
      {
        title: "The Web of Life",
        visualDescription: "Glowing threads connect bees, flowers, birds and big cats in one living web.",
        dialogue: "Pull one thread — pollinators, predators, plants — and the whole web trembles.",
        characterAction: "A bee's journey from flower to hive lights up each dependent creature in turn.",
        keyTakeaway: "Biodiversity is a safety net; every species holds part of the ecosystem together.",
      },
      {
        title: "Corridors of Hope",
        visualDescription: "Elephants cross safely through a green corridor between two forest patches.",
        dialogue: "Fragmented forests trap animals; wildlife corridors reconnect their ancient pathways.",
        characterAction: "Camera follows a herd through an underpass built specially for safe crossing.",
        keyTakeaway: "Habitat corridors let animals migrate, feed and breed across fragmented land.",
      },
      {
        title: "The Solution in Action",
        visualDescription: "Students build bird boxes, plant butterfly gardens and patrol against litter.",
        dialogue: "Even a school garden can become a sanctuary for sparrows, bees and butterflies!",
        characterAction: "Characters hang nest boxes, sow native flowers and log sightings for science.",
        keyTakeaway: "Urban micro-habitats measurably boost local birds and pollinators.",
      },
      {
        title: "Your Eco Pledge",
        visualDescription: "Dawn chorus over a thriving wetland as young naturalists watch quietly.",
        dialogue: "Observe, protect, coexist — pledge to give wildlife space and a voice.",
        characterAction: "The student joins a bird-count quest and shares findings with the class.",
        keyTakeaway: "Citizen science turns everyday sightings into real conservation data.",
      },
    ],
  },
  air: {
    label: "Clean Air",
    scenes: [
      {
        title: "The Smog Descends",
        visualDescription: "A city skyline blurred behind grey smog as vehicles crawl bumper to bumper.",
        dialogue: "Air pollution causes millions of premature deaths worldwide every single year.",
        characterAction: "A student checks the AQI board flashing hazardous red near the school gate.",
        keyTakeaway: "Traffic, dust and smoke are the main drivers of urban air pollution.",
      },
      {
        title: "The Science Behind It",
        visualDescription: "Zoom into PM2.5 particles slipping deep into animated lungs.",
        dialogue: "Particles smaller than 2.5 microns bypass our defences and enter the bloodstream.",
        characterAction: "A magnifier follows particles from exhaust pipe into alveoli sacs.",
        keyTakeaway: "Fine particulate matter is the most health-damaging air pollutant.",
      },
      {
        title: "Choking Green Cover",
        visualDescription: "Dust-coated leaves versus rain-washed leaves breathing freely.",
        dialogue: "Dust-laden leaves photosynthesize poorly — trees suffer from dirty air too.",
        characterAction: "Water droplets rinse a leaf, restoring its bright green glow.",
        keyTakeaway: "Air pollution damages plants, crops and the trees that clean our air.",
      },
      {
        title: "The Solution in Action",
        visualDescription: "Cycle rallies, carpool lanes and green belts rising along dusty roads.",
        dialogue: "Fewer engines, more trees — clean commutes clear the skies we share!",
        characterAction: "Characters plant a roadside green belt and track AQI improvements weekly.",
        keyTakeaway: "Public transport, cycling and urban greening measurably cut local pollution.",
      },
      {
        title: "Your Eco Pledge",
        visualDescription: "Blue skies return as children fly kites in a fresh city park.",
        dialogue: "Walk the short trip, mask the dusty one — pledge for breathable air.",
        characterAction: "The student starts a no-idling campaign outside the school gates.",
        keyTakeaway: "Small actions like switching off idling engines add up across a city.",
      },
    ],
  },
  general: {
    label: "Our Environment",
    scenes: [
      {
        title: "Planet in Our Hands",
        visualDescription: "Earth from space, zooming into a town where forests, rivers and streets connect.",
        dialogue: "Everything we use — food, water, air — flows from healthy ecosystems around us.",
        characterAction: "A student spins a globe and lands on their own town's green spaces.",
        keyTakeaway: "Human wellbeing depends directly on functioning natural systems.",
      },
      {
        title: "The Science Behind It",
        visualDescription: "Animated cycles of carbon, water and nutrients looping through soil and sky.",
        dialogue: "Nature runs on cycles; when we break them with waste and emissions, systems falter.",
        characterAction: "Arrows trace the carbon and water loops as factories add extra load.",
        keyTakeaway: "Disrupting natural cycles is the root cause of most eco crises.",
      },
      {
        title: "Tipping Points",
        visualDescription: "Melting glaciers, bleaching corals and drying lakes flash as warning signals.",
        dialogue: "Ecosystems can absorb stress only until a tipping point — then change turns sudden.",
        characterAction: "Warning gauges creep toward red across climate, water and forest dials.",
        keyTakeaway: "Acting early is cheaper and safer than reversing collapsed ecosystems.",
      },
      {
        title: "The Solution in Action",
        visualDescription: "Cleanup drives, plantations and solar rooftops blooming across the town.",
        dialogue: "Reduce, reuse, plant, protect — community action restores what neglect destroyed!",
        characterAction: "Characters log each good deed as an Ecosphere quest and climb the leaderboard.",
        keyTakeaway: "Local collective action is the fastest lever for visible environmental recovery.",
      },
      {
        title: "Your Eco Pledge",
        visualDescription: "A thriving green town where children play beside clean rivers and forests.",
        dialogue: "The future is a choice we make daily — pledge yours for the planet today.",
        characterAction: "The student signs the eco pledge and invites the whole class to join.",
        keyTakeaway: "Consistent small habits compound into generational environmental change.",
      },
    ],
  },
};

// Mirror of the frontend story films (frontend/src/lib/storyFilms*).
// The backend only needs each film's BEAT COUNT to shape beat rows; the
// frontend owns all choreography, cameras, and default narrations. Counts
// must stay in sync with the film definitions.
const FILM_BEAT_COUNTS: Record<string, number> = {
  forest: 6,
  ocean: 6,
  water: 5,
  solar: 5,
  wildlife: 5,
  air: 5,
  general: 5,
};

const VALID_FILMS = new Set(Object.keys(FILM_BEAT_COUNTS));

function filmForBucket(bucket: EcoBucket): string {
  switch (bucket) {
    case "forest":
      return "forest";
    case "waste":
      return "ocean";
    case "water":
      return "water";
    case "energy":
      return "solar";
    case "wildlife":
      return "wildlife";
    case "air":
      return "air";
    default:
      return "general";
  }
}

/**
 * Fallback narration lines when the director is unreachable. Samples the
 * bucket's scene library across the beat count so the problem→solution arc
 * survives even without the LLM.
 */
function fallbackNarrations(bucket: EcoBucket, count: number, prompt: string): string[] {
  const library = ECO_SCENE_LIBRARY[bucket];
  const lines = library.scenes.map((sc, i) =>
    i === 0 ? `You asked: "${prompt.trim().slice(0, 80)}". ${sc.dialogue}` : sc.dialogue,
  );
  if (lines.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const src =
      lines.length === 1
        ? lines[0]!
        : lines[Math.min(lines.length - 1, Math.round((i * (lines.length - 1)) / Math.max(1, count - 1)))]!;
    out.push(src);
  }
  return out;
}

export async function generateStudentAnimation(studentId: string, input: GenerateAnimationInput) {
  // 0. Eco-only scope gate first
  const bucket = assertEnvironmentalPrompt(input.prompt, input.topic);

  // 1. Rate limit check (15 / 24 hrs)
  const recentCount = await prisma.studentAnimation.count({
    where: {
      studentId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentCount >= 15) {
    throw new AppError(429, "ANIMATION_RATE_LIMIT", "Daily generation limit reached. Please try again tomorrow.");
  }

  // 2. Duration clamp
  const durationSeconds = Math.min(90, Math.max(15, input.durationSeconds || 45));

  // 3. Direct the story film: Groq picks the film + writes per-beat narration.
  // The frontend owns beat choreography; rows carry film + beat_index + line.
  // Stored durations are an equal split — the recorder re-times by beat weight.
  let film = filmForBucket(bucket);
  let narrations: string[] = [];
  let topicTitle = input.topic?.trim() || ECO_SCENE_LIBRARY[bucket].label;
  let provider = "procedural";

  try {
    const aiRes = await generateFilmDirection({
      prompt: input.prompt,
      topic: input.topic,
      durationSeconds,
      style: input.style ?? "CARTOON_2D",
    });

    const directed = (aiRes?.film ?? "").trim().toLowerCase();
    if (aiRes && VALID_FILMS.has(directed)) {
      film = directed;
      topicTitle = aiRes.title || aiRes.topic || topicTitle;
      narrations = (aiRes.narrations ?? []).map((n) => n.trim()).filter(Boolean);
      provider = "groq";
    }
  } catch (err) {
    console.warn("AI film director unavailable, using procedural fallback:", err);
  }

  const beatCount = FILM_BEAT_COUNTS[film] ?? 5;
  if (narrations.length === 0) {
    narrations = fallbackNarrations(bucket, beatCount, input.prompt);
  }
  const perBeat = durationSeconds / beatCount;
  const scenes = Array.from({ length: beatCount }, (_, i) => ({
    scene_number: i + 1,
    duration: i === beatCount - 1 ? durationSeconds - perBeat * (beatCount - 1) : perBeat,
    narration: narrations[i] ?? "",
    film,
    beat_index: i,
    camera: "",
    transition: "dissolve",
    background_top: "",
    background_bottom: "",
    elements: [],
    educational_point: "",
  }));

  const animation = await prisma.studentAnimation.create({
    data: {
      studentId,
      prompt: input.prompt,
      topic: topicTitle,
      style: input.style,
      durationSeconds,
      scenes: scenes as unknown as Prisma.InputJsonValue,
      status: "GENERATING",
      provider,
    },
  });

  await writeAudit({
    userId: studentId,
    action: "STUDENT.ANIMATION_GENERATE",
    entityType: "StudentAnimation",
    entityId: animation.id,
    meta: { durationSeconds, style: input.style, topicBucket: bucket, film, beatCount, provider },
    ctx: { ipAddress: null, userAgent: null },
  });

  return animation;
}

/**
 * Proxy narration text to the TTS voice. Returns raw MP3 bytes for the
 * frontend to mux into the recording. Throws 400 for bad input, 502 with the
 * provider message (e.g. terms gate) when synthesis fails.
 */
export async function synthesizeAnimationNarration(
  text: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const clean = text.trim();
  if (clean.length < 1 || clean.length > 600) {
    throw new AppError(400, "INVALID_NARRATION", "Narration text must be 1–600 characters");
  }
  return synthesizeNarrationAudio(clean);
}

export async function attachAnimationVideo(
  studentId: string,
  animationId: string,
  filename: string,
  thumbnailFilename?: string,
) {
  const anim = await prisma.studentAnimation.findFirst({
    where: { id: animationId, studentId },
  });
  if (!anim) {
    throw new AppError(404, "ANIMATION_NOT_FOUND", "Animation not found");
  }

  const videoUrl = assetUrl(filename);
  const updated = await prisma.studentAnimation.update({
    where: { id: animationId },
    data: {
      videoUrl,
      ...(thumbnailFilename ? { thumbnailUrl: assetUrl(thumbnailFilename) } : {}),
      status: "READY",
      errorMessage: null,
    },
  });

  await writeAudit({
    userId: studentId,
    action: "STUDENT.ANIMATION_VIDEO_READY",
    entityType: "StudentAnimation",
    entityId: animationId,
    meta: { videoUrl },
    ctx: { ipAddress: null, userAgent: null },
  });

  return updated;
}

/** Mark a rendering/upload job as failed with a human-readable reason. */
export async function failStudentAnimation(studentId: string, animationId: string, errorMessage: string) {
  const anim = await prisma.studentAnimation.findFirst({
    where: { id: animationId, studentId },
  });
  if (!anim) {
    throw new AppError(404, "ANIMATION_NOT_FOUND", "Animation not found");
  }
  if (anim.status === "READY") return anim;

  const updated = await prisma.studentAnimation.update({
    where: { id: animationId },
    data: { status: "FAILED", errorMessage: errorMessage.slice(0, 500) },
  });

  await writeAudit({
    userId: studentId,
    action: "STUDENT.ANIMATION_FAILED",
    entityType: "StudentAnimation",
    entityId: animationId,
    meta: { errorMessage: errorMessage.slice(0, 500) },
    ctx: { ipAddress: null, userAgent: null },
  });

  return updated;
}

/** Remove a stored upload file from disk; never fails the caller. */
async function removeStoredFile(publicUrl: string | null): Promise<void> {
  if (!publicUrl) return;
  try {
    const { env } = await import("../config/env.js");
    const filename = decodeURIComponent(publicUrl.split("/").pop() ?? "");
    // Guard against path traversal: only delete plain files inside UPLOAD_DIR.
    if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) return;
    const { default: fs } = await import("node:fs/promises");
    const { default: path } = await import("node:path");
    await fs.unlink(path.join(env.UPLOAD_DIR, filename));
  } catch {
    // Missing file etc. — nothing to do.
  }
}

export async function deleteStudentAnimation(studentId: string, id: string) {
  const anim = await prisma.studentAnimation.findFirst({
    where: { id, studentId },
  });
  if (!anim) {
    throw new AppError(404, "ANIMATION_NOT_FOUND", "Animation not found");
  }
  await prisma.studentAnimation.delete({
    where: { id },
  });
  await removeStoredFile(anim.videoUrl);
  await removeStoredFile(anim.thumbnailUrl);
  return { success: true };
}

export async function listStudentAnimations(studentId: string) {
  return prisma.studentAnimation.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStudentAnimation(studentId: string, id: string) {
  const anim = await prisma.studentAnimation.findFirst({
    where: { id, studentId },
  });
  if (!anim) {
    throw new AppError(404, "ANIMATION_NOT_FOUND", "Animation not found");
  }
  return anim;
}

