import { HttpStatusCode } from "../http";

/**
 * Thrown on HTTP response with a non-successful status code (4xx or 5xx).
 */
export class HttpError extends Error {
    /**
     * Creates a new HTTP error.
     * @param message The error message.
     * @param status The HTTP status code.
     * @param data Additional error data.
     */
    constructor(message: string, public status: HttpStatusCode, public data?: any) {
        super(message);
    }
}

/**
 * Thrown on HTTP response for a bad request (usually {@link http!HttpStatusCode.BadRequest}).
 */
export class BadRequestError extends HttpError {}

/**
 * Thrown on HTTP response for an unauthenticated request, i.e. missing credentials (usually {@link http!HttpStatusCode.Unauthorized}).
 */
export class AuthenticationError extends HttpError {}

/**
 * Thrown on HTTP response for an unauthorized request, i.e. missing permissions (usually {@link http!HttpStatusCode.Forbidden}).
 */
export class AuthorizationError extends HttpError {}

/**
 * Thrown on HTTP response for a missing resource (usually {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}).
 */
export class NotFoundError extends HttpError {}

/**
 * Thrown on HTTP response for a timed-out operation (usually {@link http!HttpStatusCode.RequestTimeout}).
 */
export class TimeoutError extends HttpError {}

/**
 * Thrown on HTTP response for a resource conflict (usually {@link http!HttpStatusCode.Conflict}).
 */
export class ConflictError extends HttpError {}

/**
 * Thrown on HTTP response for a failed precondition or mid-air collision (usually {@link http!HttpStatusCode.PreconditionFailed}).
 */
export class ConcurrencyError extends HttpError {}
