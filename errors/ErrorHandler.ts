/**
 * Handles errors in HTTP responses.
 */
export interface ErrorHandler {
    /**
     * Throws appropriate `Error`s based on HTTP status codes and response bodies.
     * @throws {@link errors!HttpError}
     */
    handle(response: Response): Promise<void>;
}
