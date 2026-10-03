// Shared job-queue contracts. Lives in lib/ so both the API (which enqueues) and
// the worker (which consumes) can import it without a circular dependency.

export const VERIFICATION_QUEUE = "verification";

export interface VerificationJobPayload {
  submissionId: string;
}
