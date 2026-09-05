import { Endpoint } from "../Endpoint";
import { HttpMethod, entityStream } from "../../http";

/**
 * Endpoint for a stream of `TEntity`s using a persistent HTTP connection.
 * @typeParam TEntity The type of individual elements in the stream.
 */
export class StreamingEndpoint<TEntity> extends Endpoint {
    /**
     * Creates a new streaming endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     * @param separator The character sequence used to detect that a new element starts in the HTTP stream.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string, private readonly separator: string = "\n") {
        super(referrer, relativeUri);
    }

    /**
     * Provides a stream of `TEntity`s, keeping the HTTP connection open until the server closes it.
     * @param signal Used to close the connection.
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    async *stream(signal?: AbortSignal): AsyncIterableIterator<TEntity> {
        // NOTE: Abort the request when the consumer stops iterating, not just when the caller's signal fires.
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        signal?.addEventListener("abort", onAbort, { once: true });
        if (signal?.aborted) controller.abort();

        try {
            const response = await this.send(HttpMethod.Get, controller.signal);
            yield* entityStream<TEntity>(response, this.serializer, this.separator);
        } catch (err) {
            // Aborting is a regular way of ending the stream, not an error
            if (!signal?.aborted) throw err;
        } finally {
            signal?.removeEventListener("abort", onAbort);
            controller.abort();
        }
    }

    /**
     * Provides a stream of `TEntity`s using {@link stream}.
     */
    [Symbol.asyncIterator]() { return this.stream(); }
}
