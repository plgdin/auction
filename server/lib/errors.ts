export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = "REQUEST_FAILED", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = "Not found") {
  return new AppError(404, message, "NOT_FOUND");
}

export function forbidden(message = "Not allowed") {
  return new AppError(403, message, "FORBIDDEN");
}

export function badRequest(message = "Invalid request", details?: unknown) {
  return new AppError(400, message, "BAD_REQUEST", details);
}

export function conflict(message = "Conflict") {
  return new AppError(409, message, "CONFLICT");
}

export function unauthorized(message = "Sign in required") {
  return new AppError(401, message, "UNAUTHORIZED");
}
