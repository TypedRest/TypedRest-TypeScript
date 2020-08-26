import { HttpHeader } from ".";

/**
 * Caches the contents of a `Response`.
 */
export class ResponseCache {
    /**
     * Creates a new cache.
     * @param content The content of the `Response`.
     * @param contentType The MIME type of the `content`.
     * @param eTag The E-Tag associated with the `content`.
     */
    constructor(public readonly content: string, public readonly contentType?: string, public readonly eTag?: string) {
    }

    /**
     * Creates a new cache from a `Response`.
     */
    static async from(response: Response) {
        return new ResponseCache(
            await response.text(),
            response.headers.get(HttpHeader.ContentType) ?? undefined,
            response.headers.get(HttpHeader.ETag) ?? undefined);
    }
}
