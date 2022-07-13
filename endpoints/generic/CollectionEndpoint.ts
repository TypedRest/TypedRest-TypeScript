import { GenericCollectionEndpoint } from "./GenericCollectionEndpoint";
import { ElementEndpoint } from "./ElementEndpoint";
import { Endpoint } from "../Endpoint";

/**
 * Endpoint for a collection of `TEntity`s addressable as `ElementEndpoint<TEntity>`s.<br>
 * Use {@link GenericCollectionEndpoint} instead if you wish to customize the element endpoint type.
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
}
