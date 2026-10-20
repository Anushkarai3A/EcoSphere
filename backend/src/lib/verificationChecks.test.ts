import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  syncVerificationChecks,
  type VerificationCheckInput,
} from "./verificationChecks.js";

interface Row {
  id: string;
  runId: string;
  checkType: string;
  status: string;
  score: number | null;
  confidence: number | null;
  message: string | null;
  details: unknown;
}

interface DeleteArgs {
  where: { runId: string; checkType?: { notIn: string[] } };
}

interface UpsertArgs {
  where: { runId_checkType: { runId: string; checkType: string } };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

class FakeCheckStore {
  private sequence = 0;
  readonly rows = new Map<string, Row>();

  private key(runId: string, checkType: string): string {
    return `${runId}:${checkType}`;
  }

  verificationCheck = {
    deleteMany: async (args: DeleteArgs) => {
      let count = 0;
      for (const [key, row] of [...this.rows.entries()]) {
        if (row.runId !== args.where.runId) continue;
        if (args.where.checkType?.notIn.includes(row.checkType)) continue;
        this.rows.delete(key);
        count += 1;
      }
      return { count };
    },
    upsert: async (args: UpsertArgs) => {
      const { runId, checkType } = args.where.runId_checkType;
      const key = this.key(runId, checkType);
      const existing = this.rows.get(key);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row: Row = {
        id: `check-${(this.sequence += 1)}`,
        runId,
        checkType,
        status: "",
        score: null,
        confidence: null,
        message: null,
        details: null,
        ...args.create,
      };
      this.rows.set(key, row);
      return row;
    },
  };
}

function storeOf(fake: FakeCheckStore) {
  return fake as unknown as Pick<Prisma.TransactionClient, "verificationCheck">;
}

test("a second run updates retained checks, removes stale ones and adds new ones", async () => {
  const fake = new FakeCheckStore();
  const runId = "run-1";

  const firstRun: VerificationCheckInput[] = [
    {
      check_type: "GPS_PROXIMITY",
      status: "PASS",
      score: 0.9,
      confidence: 0.8,
      message: "within radius",
      details: { distance_m: 12 },
    },
    {
      check_type: "TIMESTAMP_FRESHNESS",
      status: "WARN",
      message: "slightly old",
    },
  ];
  await syncVerificationChecks(storeOf(fake), runId, firstRun);
  const gpsId = fake.rows.get(`${runId}:GPS_PROXIMITY`)?.id;
  assert.ok(gpsId);

  const secondRun: VerificationCheckInput[] = [
    {
      check_type: "GPS_PROXIMITY",
      status: "FAIL",
      score: 0,
    },
    {
      check_type: "IMAGE_QUALITY",
      status: "PASS",
      confidence: 0.95,
    },
  ];
  await syncVerificationChecks(storeOf(fake), runId, secondRun);

  assert.ok(fake.rows.has(`${runId}:GPS_PROXIMITY`));
  assert.equal(fake.rows.get(`${runId}:GPS_PROXIMITY`)?.id, gpsId, "retained identity");
  assert.ok(!fake.rows.has(`${runId}:TIMESTAMP_FRESHNESS`), "removed check deleted");
  assert.ok(fake.rows.has(`${runId}:IMAGE_QUALITY`), "new check created");

  const gps = fake.rows.get(`${runId}:GPS_PROXIMITY`);
  assert.ok(gps);
  assert.equal(gps.status, "FAIL");
  assert.equal(gps.score, 0);
  assert.equal(gps.confidence, null, "stale confidence cleared");
  assert.equal(gps.message, null, "stale message cleared");
  assert.equal(gps.details, Prisma.DbNull, "stale details cleared");
});

test("an empty result clears all checks for the run", async () => {
  const fake = new FakeCheckStore();
  await syncVerificationChecks(storeOf(fake), "run-2", [
    { check_type: "GPS_PROXIMITY", status: "PASS" },
    { check_type: "IMAGE_QUALITY", status: "FAIL" },
  ]);

  await syncVerificationChecks(storeOf(fake), "run-2", []);

  assert.equal(fake.rows.size, 0);
});
