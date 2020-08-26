import { GenericCollectionEndpoint, ElementEndpoint } from ".";
import { Endpoint } from "../Endpoint";

/**
 * Endpoint for a collection of `TEntity`s addressable as `ElementEndpoint<TEntity>`s.
 * @typeParam TEntity The type of individual elements in the collection.
 */
export class CollectionEndpoint<TEntity> extends GenericCollectionEndpoint<TEntity, ElementEndpoint<TEntity>> {
    /**
     * Creates a new collection endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri, ElementEndpoint);
    }

    /**
     * Determines whether the collection contains a specific element.
     * @param element The ID identifying the entity or an entity to extract the ID from.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link HttpError}: Other non-success status code
     */
    contains(element: (TEntity | string)) { return this.get(element).exists(); }

    /**
     * Sets/replaces an existing element in the collection.
     * @param element The new state of the element.
     * @returns The `TEntity` as returned by the server, possibly with additional fields set. undefined if the server does not respond with a result entity.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    set(element: TEntity) { return this.get(element).set(element); }

    /**
     * Modifies an existing element in the collection by merging changes on the server-side.
     * @param element The `TEntity` data to merge with the existing element.
     * @returns The `TEntity` as returned by the server, possibly with additional fields set. undefined if the server does not respond with a result entity.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    merge(element: TEntity) { return this.get(element).merge(element); }

    /**
     * Deletes an existing element from the collection.
     * @param element The ID identifying the entity or an entity to extract the ID from.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    delete(element: (TEntity | string)) { return this.get(element).delete(); }
}
