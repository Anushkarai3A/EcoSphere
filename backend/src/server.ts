import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "ecosphere API listening");
});

/**
 * Graceful shutdown: stop accepting connections, let in-flight requests finish,
 * then release the Prisma pool. A hard timeout force-exits if a request hangs so
 * orchestrators (Render/Vercel/Docker) never see a zombie process.
 */
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => {
    logger.error("graceful shutdown timed out; forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (err) => {
    if (err) logger.error({ err }, "error closing http server");
    await prisma.$disconnect().catch((disconnectErr) => {
      logger.error({ err: disconnectErr }, "error disconnecting prisma");
    });
    logger.info("shutdown complete");
    process.exit(err ? 1 : 0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// A promise rejection or uncaught exception left unattended would crash the
// process anyway; log the cause and exit so the orchestrator can restart it.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled promise rejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});
