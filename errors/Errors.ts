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
 * Thrown on HTTP response for a bad request (usually {@link HttpStatusCode.BadRequest}).
 */
export class BadRequestError extends HttpError {}

/**
 * Thrown on HTTP response for an unauthenticated request, i.e. missing credentials (usually {@link HttpStatusCode.Unauthorized}).
 */
export class AuthenticationError extends HttpError {}

/**
 * Thrown on HTTP response for an unauthorized request, i.e. missing permissions (usually {@link HttpStatusCode.Forbidden}).
 */
export class AuthorizationError extends HttpError {}

/**
 * Thrown on HTTP response for a missing resource (usually {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}).
 */
export class NotFoundError extends HttpError {}

/**
 * Thrown on HTTP response for a timed-out operation (usually {@link HttpStatusCode.RequestTimeout}).
 */
export class TimeoutError extends HttpError {}

/**
 * Thrown on HTTP response for a resource conflict (usually {@link HttpStatusCode.Conflict}).
 */
export class ConflictError extends HttpError {}

/**
 * Thrown on HTTP response for a failed precondition or mid-air collision (usually {@link HttpStatusCode.PreconditionFailed}).
 */
export class ConcurrencyError extends HttpError {}
