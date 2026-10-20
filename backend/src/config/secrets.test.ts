import assert from "node:assert/strict";
import test from "node:test";
import {
  findInsecureProductionSecrets,
  insecureProductionSecretsMessage,
  type ProductionSecretConfig,
} from "./secrets.js";

const STRONG_ACCESS = "f3b1b6c2a7d94e0f8c5a1d2e3f4a5b6c";
const STRONG_REFRESH = "0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d";
const STRONG_AI_TOKEN = "9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b";

function config(overrides: Partial<ProductionSecretConfig> = {}): ProductionSecretConfig {
  return {
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: STRONG_ACCESS,
    JWT_REFRESH_SECRET: STRONG_REFRESH,
    AI_SERVICE_TOKEN: STRONG_AI_TOKEN,
    ...overrides,
  };
}

test("development and test environments keep convenient defaults", () => {
  for (const NODE_ENV of ["development", "test"] as const) {
    assert.deepEqual(
      findInsecureProductionSecrets(
        config({
          NODE_ENV,
          JWT_ACCESS_SECRET: "dev-access-secret-do-not-use",
          JWT_REFRESH_SECRET: "dev-refresh-secret-do-not-use",
          AI_SERVICE_TOKEN: "dev-ai-token",
        }),
      ),
      [],
    );
  }
});

test("production rejects every known development default", () => {
  assert.deepEqual(
    findInsecureProductionSecrets(
      config({
        JWT_ACCESS_SECRET: "dev-access-secret-do-not-use",
        JWT_REFRESH_SECRET: "dev-refresh-secret-do-not-use",
        AI_SERVICE_TOKEN: "dev-ai-token",
      }),
    ),
    ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "AI_SERVICE_TOKEN"],
  );
});

test("production rejects change-me and placeholder secrets", () => {
  assert.deepEqual(
    findInsecureProductionSecrets(
      config({
        JWT_ACCESS_SECRET: "change-me-access",
        JWT_REFRESH_SECRET: "your-refresh-secret-here",
        AI_SERVICE_TOKEN: "change-me",
      }),
    ),
    ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "AI_SERVICE_TOKEN"],
  );
});

test("production rejects reusing the same JWT secret", () => {
  assert.deepEqual(
    findInsecureProductionSecrets(config({ JWT_REFRESH_SECRET: STRONG_ACCESS })),
    ["JWT_REFRESH_SECRET"],
  );
});

test("production accepts unique non-default secrets", () => {
  assert.deepEqual(findInsecureProductionSecrets(config()), []);
});

test("startup error lists variable names but never values", () => {
  const access = "dev-access-secret-do-not-use";
  const refresh = "dev-refresh-secret-do-not-use";
  const aiToken = "dev-ai-token";
  const names = findInsecureProductionSecrets(
    config({
      JWT_ACCESS_SECRET: access,
      JWT_REFRESH_SECRET: refresh,
      AI_SERVICE_TOKEN: aiToken,
    }),
  );
  const message = insecureProductionSecretsMessage(names);

  assert.match(message, /JWT_ACCESS_SECRET/);
  assert.match(message, /JWT_REFRESH_SECRET/);
  assert.match(message, /AI_SERVICE_TOKEN/);
  for (const secret of [access, refresh, aiToken]) {
    assert.ok(!message.includes(secret));
  }
});
