import { HttpContentRange } from "../../http";

/**
 * Represents a subset of a set of elements.
 * @typeParam TEntity The type of element the response contains.
 */
export class PartialResponse<TEntity> {
    /**
     * Creates a new partial response.
     * @param elements The returned elements.
     * @param range The range the `elements` come from.
     */
    constructor(public readonly elements: TEntity[], public readonly range?: HttpContentRange) {
    }

    /**
     * Indicates whether the response reaches the end of the elements available on the server.
     */
    get endReached(): boolean {
        // No range specified, must be complete response
        if (this.range?.to === undefined) return true;

        // No length specified, can't be the end
        if (this.range.length === undefined) return false;

        return this.range.to === this.range.length - 1;
    }
}
