import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import { resolveTrustProxy } from "./proxyTrust.js";

async function listen(app: Express) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

test("trust proxy is disabled at 0 and equal to the hop count otherwise", () => {
  assert.equal(resolveTrustProxy(0), false);
  assert.equal(resolveTrustProxy(1), 1);
});

test("one trusted hop resolves the client IP and ignores a spoofed left entry", async () => {
  const app = express();
  app.set("trust proxy", resolveTrustProxy(1));
  app.get("/ip", (req, res) => {
    res.json({ ip: req.ip ?? null });
  });

  const server = await listen(app);
  try {
    const response = await fetch(`${server.url}/ip`, {
      headers: { "X-Forwarded-For": "192.0.2.99, 203.0.113.7" },
    });
    const body = (await response.json()) as { ip: string | null };
    // Rightmost entry was added by the trusted nginx hop; the left entry is client-controlled.
    assert.equal(body.ip, "203.0.113.7");
  } finally {
    await server.close();
  }
});

test("rate limiting keys on the forwarded client IP, not the nginx socket", async () => {
  const app = express();
  app.set("trust proxy", resolveTrustProxy(1));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 1,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.get("/", (_req, res) => {
    res.json({ ok: true });
  });

  const server = await listen(app);
  try {
    const firstClient = await fetch(server.url, {
      headers: { "X-Forwarded-For": "203.0.113.10" },
    });
    const secondClient = await fetch(server.url, {
      headers: { "X-Forwarded-For": "203.0.113.11" },
    });
    const firstClientAgain = await fetch(server.url, {
      headers: { "X-Forwarded-For": "203.0.113.10" },
    });

    assert.equal(firstClient.status, 200);
    assert.equal(secondClient.status, 200, "a different client must get its own bucket");
    assert.equal(firstClientAgain.status, 429, "the first client must still be limited");
  } finally {
    await server.close();
  }
});
