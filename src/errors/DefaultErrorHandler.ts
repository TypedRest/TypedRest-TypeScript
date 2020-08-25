import { ErrorHandler, HttpError, BadRequestError, AuthenticationError, AuthorizationError, NotFoundError, TimeoutError, ConflictError, ConcurrencyError, RangeError } from ".";
import { HttpStatusCode } from "../http";

/**
 * Handles errors in HTTP responses by mapping status codes to common exception types.
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
     * @throws {@link RangeError}: {@link HttpStatusCode.RequestedRangeNotSatisfiable}
     * @throws {@link HttpError}: Other non-success status code
     */
    async handle(response: Response): Promise<void> {
        if (response.ok) return;

        const message = await this.extractJsonMessage(response);
        throw DefaultErrorHandler.mapError(
            response.status,
            message ?? `HTTP ${response.status} ${response.statusText}`);
    }

    private async extractJsonMessage(response: Response): Promise<string | undefined> {
        try {
            return (await response.json()).body;
        } catch {
            return undefined;
        }
    }

    private static mapError(status: HttpStatusCode, message: string): Error {
        switch (status) {
            case HttpStatusCode.BadRequest:
                return new BadRequestError(message, status)
            case HttpStatusCode.Unauthorized:
                return new AuthenticationError(message, status)
            case HttpStatusCode.Forbidden:
                return new AuthorizationError(message, status)
            case HttpStatusCode.NotFound:
            case HttpStatusCode.Gone:
                return new NotFoundError(message, status)
            case HttpStatusCode.RequestTimeout:
                return new TimeoutError(message, status)
            case HttpStatusCode.Conflict:
                return new ConflictError(message, status)
            case HttpStatusCode.PreconditionFailed:
                return new ConcurrencyError(message, status)
            case HttpStatusCode.RequestedRangeNotSatisfiable:
                return new RangeError(message, status)
            default:
                return new HttpError(message, status);
        }
    }
}
