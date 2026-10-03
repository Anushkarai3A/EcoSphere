import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { participationApi, questApi } from "@/lib/api";
import type { CreateQuestInput, MyAcceptance, NearbyQuest, Quest } from "@/lib/types";

export interface LatLng {
  lat: number;
  lng: number;
}

export const questKeys = {
  nearby: (center: LatLng | null, radius: number, category: string) =>
    ["nearby-quests", center?.lat, center?.lng, radius, category || "all"] as const,
  teacherQuests: ["teacher-quests"] as const,
  acceptances: ["student-acceptances"] as const,
};

export interface NearbyState {
  quests: NearbyQuest[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
}

/**
 * Active quests around a center, fetched via React Query. The query key encodes
 * the center + radius, so every map move becomes its own cached entry and React
 * Query keeps old data on screen while a new viewport is loading.
 */
export function useNearbyQuests(center: LatLng | null, radius: number, category = ""): NearbyState {
  const query = useQuery({
    queryKey: questKeys.nearby(center, radius, category),
    queryFn: async () => {
      if (!center) return [] as NearbyQuest[];
      const res = await questApi.nearby({ lat: center.lat, lng: center.lng, radius, category: category || undefined });
      return res.quests;
    },
    enabled: Boolean(center),
    placeholderData: keepPreviousData,
  });

  return {
    quests: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}

/** The signed-in student's acceptances (accepted quests + progress). */
export function useStudentAcceptances(enabled = true) {
  return useQuery({
    queryKey: questKeys.acceptances,
    queryFn: async () => (await participationApi.myAcceptances()).items,
    enabled,
    staleTime: 60_000,
  });
}

/** A teacher's own quests (drafts + live), with decoded coordinates. */
export function useTeacherQuests(enabled = true) {
  return useQuery({
    queryKey: questKeys.teacherQuests,
    queryFn: async () => (await questApi.list()).items,
    enabled,
    staleTime: 60_000,
  });
}

/** Accept a quest; invalidates acceptances so the map highlight updates. */
export function useAcceptQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questId: string) => participationApi.accept(questId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: questKeys.acceptances });
    },
  });
}

/** Create a quest; refreshes the teacher's list and the nearby map layer. */
export function useCreateQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuestInput) => questApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: questKeys.teacherQuests });
      void queryClient.invalidateQueries({ queryKey: ["nearby-quests"] });
    },
  });
}

/** Shared distance helper used by quest cards + map popups. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Converts a teacher's Quest (from the list endpoint) into a map-ready quest. */
export function toNearbyQuest(quest: Quest, from: LatLng): NearbyQuest | null {
  if (quest.lat == null || quest.lng == null) return null;
  return {
    id: quest.id,
    teacherId: quest.teacherId,
    title: quest.title,
    description: quest.description,
    category: quest.category,
    difficulty: quest.difficulty,
    xpReward: Number(quest.xpReward),
    radiusMeters: quest.radiusMeters,
    requiredProofType: quest.requiredProofType,
    minPhotoCount: quest.minPhotoCount,
    addressText: quest.addressText,
    startsAt: quest.startsAt,
    endsAt: quest.endsAt,
    distanceMeters: haversineMeters(from, { lat: quest.lat, lng: quest.lng }),
    lat: quest.lat,
    lng: quest.lng,
  };
}

export function activeAcceptances(items: MyAcceptance[]): MyAcceptance[] {
  return items.filter((a) => a.status === "ACCEPTED" || a.status === "IN_PROGRESS");
}

export function acceptedQuestIds(items: MyAcceptance[]): string[] {
  return items.map((a) => a.quest.id);
}

/** Simple XP curve: reaching level n+1 from level n costs 100 × n XP. */
export function levelFromXp(xp: number): { level: number; levelProgress: number; levelTarget: number } {
  const n = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / 100)) / 2));
  const currentFloor = (100 * n * (n - 1)) / 2;
  const nextFloor = (100 * (n + 1) * n) / 2;
  return { level: n, levelProgress: xp - currentFloor, levelTarget: nextFloor - currentFloor };
}

export interface StudentStats {
  totalXp: number;
  activeCount: number;
  submittedCount: number;
  completedCount: number;
  level: number;
  levelProgress: number;
  levelTarget: number;
}

/** Aggregated student dashboard stats derived from the acceptances feed. */
export function useStudentStats(): StudentStats {
  const acceptances = useStudentAcceptances();
  const items = acceptances.data ?? [];
  const totalXp = items.reduce((sum, a) => sum + Number(a.xpAwarded || 0), 0);
  const { level, levelProgress, levelTarget } = levelFromXp(totalXp);
  return {
    totalXp,
    activeCount: activeAcceptances(items).length,
    submittedCount: items.filter((a) => a.status === "SUBMITTED").length,
    completedCount: items.filter((a) => a.status === "APPROVED").length,
    level,
    levelProgress,
    levelTarget,
  };
}
