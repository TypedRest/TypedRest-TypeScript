import { Endpoint } from "../Endpoint";

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
}
