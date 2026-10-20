// Environment-aware secret hardening.
//
// Development keeps working with convenient defaults. Production startup must
// fail when a known development value or placeholder is still in use. Only
// variable names are reported: secret values never appear in logs or errors.

export interface ProductionSecretConfig {
  NODE_ENV: "development" | "test" | "production";
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  AI_SERVICE_TOKEN: string;
}

const KNOWN_DEVELOPMENT_SECRETS = new Set([
  "dev-access-secret-do-not-use",
  "dev-refresh-secret-do-not-use",
  "dev-ai-token",
  "change-me",
  "change-me-access",
  "change-me-access-secret",
  "change-me-refresh",
  "change-me-refresh-secret",
  "changeme",
  "secret",
  "your-secret-here",
]);

function isInsecureSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    KNOWN_DEVELOPMENT_SECRETS.has(normalized) ||
    normalized.startsWith("change-me") ||
    normalized.startsWith("your-") ||
    normalized.includes("do-not-use")
  );
}

/**
 * Returns the names of production secret variables that are still using known
 * development values or placeholders. Empty in non-production environments.
 */
export function findInsecureProductionSecrets(config: ProductionSecretConfig): string[] {
  if (config.NODE_ENV !== "production") {
    return [];
  }

  const insecure: string[] = [];
  if (isInsecureSecret(config.JWT_ACCESS_SECRET)) {
    insecure.push("JWT_ACCESS_SECRET");
  }
  if (isInsecureSecret(config.JWT_REFRESH_SECRET)) {
    insecure.push("JWT_REFRESH_SECRET");
  }
  if (isInsecureSecret(config.AI_SERVICE_TOKEN)) {
    insecure.push("AI_SERVICE_TOKEN");
  }
  if (
    config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET &&
    !insecure.includes("JWT_REFRESH_SECRET")
  ) {
    insecure.push("JWT_REFRESH_SECRET");
  }
  return insecure;
}

/** Builds a startup error that lists only variable names, never values. */
export function insecureProductionSecretsMessage(variableNames: string[]): string {
  return (
    "Refusing to start in production with insecure secret configuration: " +
    `${variableNames.join(", ")}. Set unique, non-default values for each variable.`
  );
}
