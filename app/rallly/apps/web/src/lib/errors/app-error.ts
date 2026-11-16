export type AppErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_SESSION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "PAYMENT_REQUIRED"
  | "PAYLOAD_TOO_LARGE"
  | "POLL_FULL"
  // [projet] Réservation (#139)
  | "SLOT_TAKEN"
  | "BOOKING_LIMIT"
  // [projet] Expiration (#134)
  | "POLL_EXPIRED"
  // [projet] Champs personnalisés (#201)
  | "CUSTOM_FIELDS_CHANGED"
  | "SERVICE_UNAVAILABLE"
  | "SETUP_REQUIRED"
  | "TOO_MANY_REQUESTS";

export class AppError extends Error {
  code: AppErrorCode;
  constructor({
    code,
    message,
    cause,
  }: {
    code: AppErrorCode;
    message: string;
    cause?: unknown;
  }) {
    super(`[${code}]: ${message}`);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}
