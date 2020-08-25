import { Endpoint } from "../Endpoint";
import { CachingEndpoint } from "../CachingEndpoint";
import { HttpMethod, HttpHeader, HttpStatusCode, ResponseCache } from "../../http";

/**
 * Base class for building endpoints that use ETags (entity tags) for caching and to avoid lost updates.
 */
export class ETagEndpointBase extends Endpoint implements CachingEndpoint {
    /**
     * Creates a new endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri);
    }

    /**
     * @inheritdoc
     */
    public responseCache?: ResponseCache;

    /**
     * Performs an {@link HttpMethod.Put} request on the {@link uri} and caches the response if the server sends an {@link HttpHeader.ETag}.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    protected async getContent(): Promise<string> {
        const headers = new Headers();
        if (this.responseCache?.eTag) headers.append(HttpHeader.IfNoneMatch, this.responseCache.eTag);

        const response = await this.httpClient.send(this.uri, HttpMethod.Get, new Headers(headers));
        if (response.status !== HttpStatusCode.NotModified || !this.responseCache?.content) {
            await this.handle(response);
            this.responseCache = await ResponseCache.from(response);
        }

        return this.responseCache.content;
    }

    /**
     * Performs an {@link HttpMethod.Put} request on the {@link uri}. Sets {@link HttpHeader.IfMatch} if there is a cached {@link HttpHeader.ETag} to detect lost updates.
     * @throws {@link ConcurrencyError}: The entity has changed since it was last retrieved with {@link getContent}. Your changes were rejected to prevent a lost update.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    protected async putContent(content: any): Promise<Response> {
        const headers = new Headers();
        headers.append(HttpHeader.ContentType, this.serializer.supportedMediaTypes[0])
        if (this.responseCache?.eTag) headers.append(HttpHeader.IfMatch, this.responseCache.eTag);

        this.responseCache = undefined;
        return this.send(HttpMethod.Put, headers, this.serializer.serialize(content));
    }

    /**
     * Performs an {@link HttpMethod.Delete} request on the {@link uri}. Sets {@link HttpHeader.IfMatch} if there is a cached {@link HttpHeader.ETag} to detect lost updates.
     * @throws {@link ConcurrencyError}: The entity has changed since it was last retrieved with {@link getContent}. Your changes were rejected to prevent a lost update.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    protected async deleteContent(): Promise<Response> {
        const headers = new Headers();
        if (this.responseCache?.eTag) headers.append(HttpHeader.IfMatch, this.responseCache.eTag);

        this.responseCache = undefined;
        return this.send(HttpMethod.Delete, headers);
    }
}
