// PostGIS access layer.
//
// Prisma has no native geometry type, so spatial columns (`Unsupported`) are read
// and written exclusively through raw SQL. Centralizing these queries here keeps
// the rest of the codebase free of raw SQL strings.

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Distance in meters between a point and a quest (server-side, fraud-critical). */
export async function distanceQuestToPoint(questId: string, point: GeoPoint): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ distance_m: number }>>`
    SELECT ST_Distance(
      q.location::geography,
      ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
    ) AS distance_m
    FROM quests q
    WHERE q.id = ${questId}
  `;
  return rows[0]?.distance_m ?? Number.POSITIVE_INFINITY;
}

/** Whether a point falls within a quest's configured radius. */
export async function isPointInQuestRadius(questId: string, point: GeoPoint): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ inside: boolean }>>`
    SELECT ST_Distance(
      q.location::geography,
      ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
    ) <= q.radius_meters AS inside
    FROM quests q
    WHERE q.id = ${questId}
  `;
  return rows[0]?.inside ?? false;
}

/** Set a submission's recorded device location (single statement). */
export async function setSubmissionLocation(
  submissionId: string,
  point: GeoPoint,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE quest_submissions
    SET location = ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)
    WHERE id = ${submissionId}
  `;
}

/** Decode a submission's recorded device location, or null when unset. */
export async function submissionLocation(submissionId: string): Promise<GeoPoint | null> {
  const rows = await prisma.$queryRaw<Array<{ lat: number; lng: number } | { lat: null }>>`
    SELECT ST_Y(location) AS lat, ST_X(location) AS lng
    FROM quest_submissions
    WHERE id = ${submissionId}
  `;
  const row = rows[0];
  if (!row || row.lat === null || row.lng === undefined) return null;
  return { lat: row.lat, lng: row.lng };
}

/** Active quests near a point, ordered by distance. Used by the map endpoint. */
export async function findActiveQuestsNear(
  point: GeoPoint,
  maxRadiusMeters: number,
  limit = 250,
): Promise<
  Array<{ id: string; title: string; distance_m: number }>
> {
  return prisma.$queryRaw`
    SELECT q.id, q.title,
           ST_Distance(
             q.location::geography,
             ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
           ) AS distance_m
    FROM quests q
    WHERE q.status = 'ACTIVE'
      AND q.starts_at <= now()
      AND q.ends_at > now()
      AND ST_DWithin(
        q.location::geography,
        ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
        ${maxRadiusMeters}
      )
    ORDER BY distance_m
    LIMIT ${limit}
  `;
}

/** Insert a quest with its spatial point in a single statement. */
export async function createQuestWithLocation(
  data: {
    id: string;
    point: GeoPoint;
  },
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE quests
    SET location = ST_SetSRID(ST_MakePoint(${data.point.lng}, ${data.point.lat}), 4326)
    WHERE id = ${data.id}
  `;
}

/** Raw row shape returned by Postgres for the map/nearby query. */
interface RawNearbyQuestRow {
  id: string;
  teacher_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  xp_reward: string;
  radius_meters: number;
  required_proof_type: string;
  min_photo_count: number;
  address_text: string | null;
  starts_at: Date;
  ends_at: Date;
  distance_meters: number;
  lat: number;
  lng: number;
}

/** Row shape returned by the map/nearby query (geometry already decoded). */
export interface NearbyQuestRow {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  xpReward: number;
  radiusMeters: number;
  requiredProofType: string;
  minPhotoCount: number;
  addressText: string | null;
  startsAt: Date;
  endsAt: Date;
  distanceMeters: number;
  lat: number;
  lng: number;
}

export interface NearbyQuery {
  point: GeoPoint;
  maxRadiusMeters: number;
  category?: string;
  limit?: number;
}

/** Active quests near a point with decoded geometry, for the student map. */
export async function findActiveQuestsNearFull(
  query: NearbyQuery,
): Promise<NearbyQuestRow[]> {
  const { point, maxRadiusMeters, category, limit = 250 } = query;
  const rows = await prisma.$queryRaw<RawNearbyQuestRow[]>`
    SELECT q.id,
           q.teacher_id,
           q.title,
           q.description,
           q.category,
           q.difficulty,
           q.xp_reward,
           q.radius_meters,
           q.required_proof_type,
           q.min_photo_count,
           q.address_text,
           q.starts_at,
           q.ends_at,
           ST_Distance(
             q.location::geography,
             ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
           ) AS distance_meters,
           ST_Y(q.location) AS lat,
           ST_X(q.location) AS lng
    FROM quests q
    WHERE q.status = 'ACTIVE'
      AND q.archived_at IS NULL
      AND q.starts_at <= now()
      AND q.ends_at > now()
      AND (${category}::text IS NULL OR q.category::text = ${category})
      AND ST_DWithin(
        q.location::geography,
        ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
        ${maxRadiusMeters}
      )
    ORDER BY distance_meters
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    teacherId: row.teacher_id,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    xpReward: Number(row.xp_reward),
    radiusMeters: row.radius_meters,
    requiredProofType: row.required_proof_type,
    minPhotoCount: row.min_photo_count,
    addressText: row.address_text,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    distanceMeters: row.distance_meters,
    lat: row.lat,
    lng: row.lng,
  }));
}

/** Whether a quest has a spatial point (required before publishing). */
export async function hasQuestLocation(questId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ has_location: boolean }>>`
    SELECT (location IS NOT NULL) AS has_location
    FROM quests
    WHERE id = ${questId}
  `;
  return rows[0]?.has_location ?? false;
}

/** Decode a quest's geometry column into a GeoPoint, or null when unset. */
export async function questLocation(questId: string): Promise<GeoPoint | null> {
  const rows = await prisma.$queryRaw<Array<{ lat: number; lng: number } | { lat: null }>>`
    SELECT ST_Y(location) AS lat, ST_X(location) AS lng
    FROM quests
    WHERE id = ${questId}
  `;
  const row = rows[0];
  if (!row || row.lat === null || row.lng === undefined) return null;
  return { lat: row.lat, lng: row.lng };
}

/** Decode the geometry of many quests at once (id → point). */
export async function questsLocations(questIds: string[]): Promise<Map<string, GeoPoint>> {
  const out = new Map<string, GeoPoint>();
  const ids = [...new Set(questIds)].filter((id) => id.length > 0);
  if (ids.length === 0) return out;
  const rows = await prisma.$queryRaw<Array<{ id: string; lat: number; lng: number }>>`
    SELECT id, ST_Y(location) AS lat, ST_X(location) AS lng
    FROM quests
    WHERE id IN (${Prisma.join(ids)}) AND location IS NOT NULL
  `;
  for (const row of rows) out.set(row.id, { lat: row.lat, lng: row.lng });
  return out;
}
