import { ElementEndpoint } from "../generic/ElementEndpoint";
import { Endpoint } from "../Endpoint";
import { delay } from "./Delay";
import { retryAfter } from "../../http";

/**
 * Endpoint for a resource that can be polled for state changes.
 * @typeParam TEntity The type of entity the endpoint represents.
 */
export class PollingEndpoint<TEntity> extends ElementEndpoint<TEntity> {
    /**
     * Creates a new polling endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     * @param endCondition A check to determine whether the entity has reached its final state and no further polling is required.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string, private readonly endCondition?: (entity: TEntity) => boolean) {
        super(referrer, relativeUri);
    }

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
     * Provides a stream of the `TEntity`'s states, polling the server for changes.
     * States that are identical to the previously provided one are skipped.
     * @param signal Used to stop polling.
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    async *stream(signal?: AbortSignal): AsyncIterableIterator<TEntity> {
        // NOTE: Compare the serialized form because every poll deserializes a new object instance.
        let previous: string | undefined;

        while (!signal?.aborted) {
            const entity = await this.read(signal);

            const serialized = this.serializer.serialize(entity);
            if (serialized !== previous) {
                previous = serialized;
                yield entity;
            }

            if (this.endCondition?.(entity)) return;
            if (!await delay(this.pollingInterval, signal)) return;
        }
    }

    /**
     * Provides a stream of the `TEntity`'s states using {@link stream}.
     */
    [Symbol.asyncIterator]() { return this.stream(); }
}
