import { GenericStreamingCollectionEndpoint } from "./GenericStreamingCollectionEndpoint";
import { ElementEndpoint } from "../generic/ElementEndpoint";
import { Endpoint } from "../Endpoint";

/**
 * Endpoint for a collection of `TEntity`s observable as an append-only stream using long-polling,
 * addressable as {@link ElementEndpoint}s.<br>
 * Use {@link GenericStreamingCollectionEndpoint} instead if you wish to customize the element endpoint type.
 * @typeParam TEntity The type of individual elements in the collection.
 */
export class StreamingCollectionEndpoint<TEntity> extends GenericStreamingCollectionEndpoint<TEntity, ElementEndpoint<TEntity>> {
    /**
     * Creates a new streaming collection endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri, ElementEndpoint);
    }
}
