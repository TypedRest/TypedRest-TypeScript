import { ErrorHandler } from "./ErrorHandler";
import { HttpError, BadRequestError, AuthenticationError, AuthorizationError, NotFoundError, TimeoutError, ConflictError, ConcurrencyError } from "./Errors";
import { HttpStatusCode, HttpHeader } from "../http";

/**
 * Handles errors in HTTP responses by mapping status codes to common error types.
 */
export class DefaultErrorHandler implements ErrorHandler {
    /**
     * Throws appropriate `Error`s based on HTTP status codes and response bodies.
     *
     * @throws {@link errors!BadRequestError}: {@link http!HttpStatusCode.BadRequest}
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!TimeoutError}: {@link http!HttpStatusCode.RequestTimeout}
     * @throws {@link errors!ConflictError}: {@link http!HttpStatusCode.Conflict}
     * @throws {@link errors!ConcurrencyError}: {@link http!HttpStatusCode.PreconditionFailed}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    async handle(response: Response) {
        if (response.ok) return;

        const contentType = response.headers.get(HttpHeader.ContentType);
        const jsonBody = (contentType?.startsWith("application/json") || contentType?.includes("+json"))
            ? await response.json()
            : undefined;

        const errorType = DefaultErrorHandler.errorType(response.status);
        throw new errorType(
            jsonBody?.message ?? jsonBody?.details ?? `HTTP ${response.status} ${response.statusText}`,
            response.status,
            jsonBody);
    }

    private static errorType(status: HttpStatusCode): new (message: string, status: HttpStatusCode, data?: any) => Error {
        switch (status) {
            case HttpStatusCode.BadRequest:
                return BadRequestError;
            case HttpStatusCode.Unauthorized:
                return AuthenticationError;
            case HttpStatusCode.Forbidden:
                return AuthorizationError;
            case HttpStatusCode.NotFound:
            case HttpStatusCode.Gone:
                return NotFoundError;
            case HttpStatusCode.RequestTimeout:
                return TimeoutError;
            case HttpStatusCode.Conflict:
                return ConflictError;
            case HttpStatusCode.PreconditionFailed:
                return ConcurrencyError;
            default:
                return HttpError;
        }
    }
}
