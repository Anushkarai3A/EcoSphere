import { pino } from "pino";

// pino-pretty runs in a worker thread. Skip it in tests so the worker cannot
// keep the test process alive after the suite finishes.
const prettyTransport =
  process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: prettyTransport
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
    : undefined,
});
