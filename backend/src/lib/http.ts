/**
 * Application error with a stable machine-readable code and optional details.
 * The API layer serializes this into the standard error envelope.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
