import { Endpoint } from "../Endpoint";
import { ElementEndpoint } from "./ElementEndpoint";
import { ResponseCache } from "../../http";

/**
 * Endpoint that addresses child `TElementEndpoint`s by ID.
 * @typeParam TElementEndpoint The type of {@link Endpoint} to provide for individual elements.
 */
export class IndexerEndpoint<TElementEndpoint extends Endpoint> extends Endpoint {
    /**
     * Creates a new indexer endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     * @param elementEndpoint A factory method for creating instances of `TElementEndpoint`.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string, private readonly elementEndpoint: new (referrer: Endpoint, uri: URL) => TElementEndpoint) {
        super(referrer, relativeUri);
        this.setDefaultLinkTemplate("child", "./{id}");
    }

    /**
     * Returns a `TElementEndpoint` for a specific child element.
     * @param id The ID identifying the entity.
     */
    get(id: string): TElementEndpoint {
        if (id == null || id === "") throw new Error("id must not be null, unspecified or empty.");
        return new this.elementEndpoint(this, this.linkTemplate("child", { id }));
    }

    /**
     * Determines whether the collection contains a specific element.
     * Only available if `TElementEndpoint` is an {@link ElementEndpoint}.
     * @param id The ID identifying the entity.
     * @param signal Used to cancel the request.
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    contains(this: IndexerEndpoint<ElementEndpoint<unknown>>, id: string, signal?: AbortSignal) { return this.get(id).exists(signal); }

    /**
     * Deletes an existing element from the collection.
     * Only available if `TElementEndpoint` is an {@link ElementEndpoint}.<br>
     * This creates a new `TElementEndpoint` with an empty cache, so {@link http!HttpHeader.IfMatch} is only sent if you specify `basedOn`.
     * Alternatively, keep the `TElementEndpoint` from {@link get} and call `read()` and `delete()` on it.
     * @param id The ID identifying the entity.
     * @param signal Used to cancel the request.
     * @param basedOn The version the deletion is based on, e.g., the element endpoint's `responseCache` captured when the user decided to delete. Leave unspecified to send no precondition.
     * @throws {@link errors!ConcurrencyError}: The element has changed since `basedOn`. The deletion was rejected to prevent a lost update.
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    delete(this: IndexerEndpoint<ElementEndpoint<unknown>>, id: string, signal?: AbortSignal, basedOn?: ResponseCache) { return this.get(id).delete(signal, basedOn); }
}
