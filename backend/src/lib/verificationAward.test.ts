import assert from "node:assert/strict";
import test from "node:test";
import { awardAutoApproval, type AutoApprovalInput } from "./verificationAward.js";

type AwardTransaction = Parameters<typeof awardAutoApproval>[0];

interface LedgerRow {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string | null;
  amount: number;
  balanceAfter: number;
  note: string | null;
}

interface Snapshot {
  submission: { status: string; reviewedAt: Date | null };
  acceptance: { status: string; completedAt: Date | null; xpAwarded: number };
  ledger: LedgerRow[];
}

class FakeAwardDb {
  submission = { status: "PENDING_VERIFICATION", reviewedAt: null as Date | null };
  acceptance = { status: "SUBMITTED", completedAt: null as Date | null, xpAwarded: 0 };
  ledger: LedgerRow[] = [];
  failNextCreate = false;
  private sequence = 0;

  private snapshot(): Snapshot {
    return {
      submission: { ...this.submission },
      acceptance: { ...this.acceptance },
      ledger: this.ledger.map((row) => ({ ...row })),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.submission = snapshot.submission;
    this.acceptance = snapshot.acceptance;
    this.ledger = snapshot.ledger;
  }

  private readonly tx = {
    questSubmission: {
      updateMany: async (args: {
        where: { id: string; status: string };
        data: { status: string; reviewedAt: Date };
      }) => {
        if (this.submission.status !== args.where.status) {
          return { count: 0 };
        }
        this.submission = {
          status: args.data.status,
          reviewedAt: args.data.reviewedAt,
        };
        return { count: 1 };
      },
    },
    questAcceptance: {
      update: async (args: {
        where: { id: string };
        data: { status: string; completedAt: Date; xpAwarded: number };
      }) => {
        this.acceptance = {
          status: args.data.status,
          completedAt: args.data.completedAt,
          xpAwarded: args.data.xpAwarded,
        };
        return this.acceptance;
      },
    },
    xpTransaction: {
      findFirst: async (args: {
        where: { userId?: string; sourceType?: string; sourceId?: string };
      }) => {
        if (args.where.sourceType && args.where.sourceId) {
          const match = this.ledger.find(
            (row) =>
              row.sourceType === args.where.sourceType &&
              row.sourceId === args.where.sourceId,
          );
          return match ? { id: match.id } : null;
        }
        const last = this.ledger.at(-1);
        return last ? { balanceAfter: last.balanceAfter } : null;
      },
      create: async (args: {
        data: {
          userId: string;
          sourceType: string;
          sourceId: string;
          amount: number;
          balanceAfter: number;
          note: string | null;
        };
      }) => {
        if (this.failNextCreate) {
          this.failNextCreate = false;
          throw new Error("simulated write failure");
        }
        const row: LedgerRow = {
          id: `xp-${(this.sequence += 1)}`,
          ...args.data,
        };
        this.ledger.push(row);
        return row;
      },
    },
  } as unknown as AwardTransaction;

  async transaction<T>(fn: (tx: AwardTransaction) => Promise<T>): Promise<T> {
    const before = this.snapshot();
    try {
      return await fn(this.tx);
    } catch (err) {
      this.restore(before);
      throw err;
    }
  }
}

function input(): AutoApprovalInput {
  return {
    submissionId: "submission-1",
    acceptanceId: "acceptance-1",
    studentId: "student-1",
    questTitle: "Plant a sapling",
    xp: 100,
    now: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("sequential redelivery awards XP only once", async () => {
  const db = new FakeAwardDb();

  const first = await db.transaction((tx) => awardAutoApproval(tx, input()));
  const second = await db.transaction((tx) => awardAutoApproval(tx, input()));

  assert.equal(first, "awarded");
  assert.equal(second, "already-processed");
  assert.equal(db.ledger.length, 1);
  assert.equal(db.submission.status, "AUTO_APPROVED");
  assert.equal(db.acceptance.status, "APPROVED");
  assert.equal(db.acceptance.xpAwarded, 100);
});

test("an existing ledger row prevents a second award", async () => {
  const db = new FakeAwardDb();
  db.ledger.push({
    id: "legacy-xp",
    userId: "student-1",
    sourceType: "QUEST_COMPLETION",
    sourceId: "submission-1",
    amount: 100,
    balanceAfter: 100,
    note: "legacy",
  });

  const outcome = await db.transaction((tx) => awardAutoApproval(tx, input()));

  assert.equal(outcome, "already-processed");
  assert.equal(db.ledger.length, 1);
  assert.equal(db.submission.status, "PENDING_VERIFICATION");
});

test("two concurrent deliveries produce one award", async () => {
  const db = new FakeAwardDb();

  const outcomes = await Promise.all([
    db.transaction((tx) => awardAutoApproval(tx, input())),
    db.transaction((tx) => awardAutoApproval(tx, input())),
  ]);

  assert.deepEqual(outcomes.sort(), ["already-processed", "awarded"]);
  assert.equal(db.ledger.length, 1);
});

test("a failure inside the transaction rolls back and a retry can award exactly once", async () => {
  const db = new FakeAwardDb();
  db.failNextCreate = true;

  await assert.rejects(
    db.transaction((tx) => awardAutoApproval(tx, input())),
    /simulated write failure/,
  );

  assert.equal(db.submission.status, "PENDING_VERIFICATION");
  assert.equal(db.acceptance.status, "SUBMITTED");
  assert.equal(db.ledger.length, 0);

  const retry = await db.transaction((tx) => awardAutoApproval(tx, input()));
  assert.equal(retry, "awarded");
  assert.equal(db.ledger.length, 1);
});
