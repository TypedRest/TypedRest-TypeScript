import { ElementEndpoint } from "../generic/ElementEndpoint";
import { GenericCollectionEndpoint } from "../generic/GenericCollectionEndpoint";
import { PartialResponse } from "../generic/PartialResponse";
import { delay } from "./Delay";
import { retryAfter } from "../../http";
import { RangeNotSatisfiableError } from "../../errors";

/**
 * Endpoint for a collection of `TEntity`s observable as an append-only stream using long-polling.<br>
 * Use {@link StreamingCollectionEndpoint} instead if you wish to use the default {@link ElementEndpoint} type.
 * @typeParam TEntity The type of individual elements in the collection.
 * @typeParam TElementEndpoint The type of {@link ElementEndpoint} to provide for individual `TEntity`s.
 */
export class GenericStreamingCollectionEndpoint<TEntity, TElementEndpoint extends ElementEndpoint<TEntity>> extends GenericCollectionEndpoint<TEntity, TElementEndpoint> {
    /**
     * The interval in milliseconds to wait between polling requests.
     * Automatically updated whenever the server sends a {@link http!HttpHeader.RetryAfter} header.
     */
    pollingInterval = 3000;

    /**
     * @inheritDoc
     */
    protected async handle(response: Response) {
        await super.handle(response);
        this.pollingInterval = retryAfter(response) ?? this.pollingInterval;
    }

    /**
     * Provides a stream of `TEntity`s, polling the server for elements appended to the collection.
     * @param startIndex The index of the first element to return. Use a negative value to start with the last `-startIndex` elements ("tail").
     * @param signal Used to stop polling.
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    async *stream(startIndex: number = 0, signal?: AbortSignal): AsyncIterableIterator<TEntity> {
        let currentStartIndex = startIndex;

        while (!signal?.aborted) {
            let response: PartialResponse<TEntity>;
            try {
                response = (currentStartIndex >= 0)
                    // Offset
                    ? await this.readRange(currentStartIndex, undefined, signal)
                    // Tail
                    : await this.readRange(undefined, -currentStartIndex, signal);
            } catch (err) {
                // Aborting is a regular way of ending the stream, not an error
                if (signal?.aborted) return;
                if (!(err instanceof RangeNotSatisfiableError)) throw err;

                // No new data available yet, keep polling
                if (!await delay(this.pollingInterval, signal)) return;
                continue;
            }

            yield* response.elements;
            if (response.endReached) return;

            // Continue polling for more data
            if (response.range?.to === undefined) return;
            currentStartIndex = response.range.to + 1;

            if (!await delay(this.pollingInterval, signal)) return;
        }
    }

    /**
     * Provides a stream of `TEntity`s using {@link stream}.
     */
    [Symbol.asyncIterator]() { return this.stream(); }
}
