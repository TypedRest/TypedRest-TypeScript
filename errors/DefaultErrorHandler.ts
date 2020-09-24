import { ErrorHandler, HttpError, BadRequestError, AuthenticationError, AuthorizationError, NotFoundError, TimeoutError, ConflictError, ConcurrencyError } from ".";
import { HttpStatusCode, HttpHeader } from "../http";

/**
 * Handles errors in HTTP responses by mapping status codes to common error types.
 */
export class DefaultErrorHandler implements ErrorHandler {
    /**
     * Throws appropriate `Error`s based on HTTP status codes and response bodies.
     *
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link TimeoutError}: {@link HttpStatusCode.RequestTimeout}
     * @throws {@link ConflictError}: {@link HttpStatusCode.Conflict}
     * @throws {@link ConcurrencyError}: {@link HttpStatusCode.PreconditionFailed}
     * @throws {@link HttpError}: Other non-success status code
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
