import { ETagEndpointBase } from ".";
import { Endpoint } from "../Endpoint";
import { HttpMethod, HttpHeader, HttpStatusCode } from "../../http";
import { ConcurrencyError } from "../../errors";

/**
 * Endpoint for an individual resource.
 * @typeParam TEntity The type of entity the endpoint represents.
 */
export class ElementEndpoint<TEntity> extends ETagEndpointBase {
    /**
     * Creates a new element endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri);
    }

    /**
     * A cached copy of the entity as received from the server.
     */
    public get response(): TEntity | undefined {
        return this.responseCache
            ? this.serializer.deserialize<TEntity>(this.responseCache.content)
            : undefined;
    }

    /**
     * Returns the `TEntity`.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async read() { return this.serializer.deserialize<TEntity>(await this.getContent()); }

    /**
     * Determines whether the element currently exists.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link HttpError}: Other non-success status code
     */
    async exists() {
        const response = await this.httpClient.send(this.uri, HttpMethod.Head);
        if (response.ok) return true;
        if (response.status === HttpStatusCode.NotFound || response.status === HttpStatusCode.Gone) return false;

        await this.errorHandler.handle(response);
        return false;
    }

    /**
     * Shows whether the server has indicated that {@link set} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get setAllowed() { return this.isMethodAllowed(HttpMethod.Put); }

    /**
     * Sets/replaces the `TEntity`.
     * @param entity The new `TEntity`.
     * @returns The `TEntity` as returned by the server, possibly with additional fields set. undefined if the server does not respond with a result entity.
     * @throws {@link ConcurrencyError}: The entity has changed since it was last retrieved with {@link read}. Your changes were rejected to prevent a lost update.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async set(entity: TEntity): Promise<(TEntity | undefined)> {
        const response = await this.putContent(entity);
        const text = await response.text();
        if (text) {
            return this.serializer.deserialize<TEntity>(text);
        }
    }

    /**
     * Shows whether the server has indicated that {@link merge} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get mergeAllowed() { return this.isMethodAllowed(HttpMethod.Patch); }

    /**
     * Modifies an existing `TEntity` by merging changes on the server-side.
     * @param entity The `TEntity` data to merge with the existing element.
     * @returns The `TEntity` as returned by the server, possibly with additional fields set. undefined if the server does not respond with a result entity.
     * @throws {@link ConcurrencyError}: The entity has changed since it was last retrieved with {@link read}. Your changes were rejected to prevent a lost update.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async merge(entity: TEntity): Promise<(TEntity | undefined)> {
        this.responseCache = undefined;
        const response = await this.send(HttpMethod.Patch, {
            [HttpHeader.ContentType]: this.serializer.supportedMediaTypes[0]
        }, this.serializer.serialize(entity));

        const text = await response.text();
        if (text) {
            return this.serializer.deserialize<TEntity>(text);
        }
    }

    /**
     * Reads the current state of the entity, applies a change to it and stores the result. Applies optimistic concurrency using automatic retries.
     * @param updateAction A callback that takes the current state of the entity and applies the desired modifications.
     * @param maxRetries The maximum number of retries to perform for optimistic concurrency before giving up.
     * @returns The `TEntity` as returned by the server, possibly with additional fields set. undefined if the server does not respond with a result entity.
     * @throws {@link ConcurrencyError}: The maximum number of retries to perform for optimistic concurrency before giving up.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async update(updateAction: (entity: TEntity) => void, maxRetries: number = 3): Promise<(TEntity | undefined)> {
        let retryCounter = 0;
        while (true) {
            const entity = await this.read();
            updateAction(entity);
            try {
                return await this.set(entity);
            } catch (err) {
                if (retryCounter++ >= maxRetries || !(err instanceof ConcurrencyError))
                    throw err;
            }
        }
    }

    /**
     * Shows whether the server has indicated that {@link delete} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get deleteAllowed() { return this.isMethodAllowed(HttpMethod.Delete); }

    /**
     * Deletes the element.
     * @throws {@link ConcurrencyError}: The entity has changed since it was last retrieved with {@link read}. Your changes were rejected to prevent a lost update.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async delete() { await this.deleteContent(); }
}
