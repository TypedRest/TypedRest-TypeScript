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
     * @inheritDoc
     */
    public responseCache?: ResponseCache;

    /**
     * Performs an {@link http!HttpMethod.Put} request on the {@link uri} and caches the response if the server sends an {@link http!HttpHeader.ETag}.
     * @param signal Used to cancel the request.
     * @throws {@link errors!BadRequestError}: {@link http!HttpStatusCode.BadRequest}
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    protected async getContent(signal?: AbortSignal): Promise<string> {
        const headers = new Headers();
        if (this.responseCache?.eTag) headers.append(HttpHeader.IfNoneMatch, this.responseCache.eTag);

        const response = await this.httpClient.send(this.uri, HttpMethod.Get, signal, new Headers(headers));
        if (response.status !== HttpStatusCode.NotModified || !this.responseCache?.content) {
            await this.handle(response);
            this.responseCache = await ResponseCache.from(response);
        }

        return this.responseCache.content;
    }

    /**
     * Performs an {@link http!HttpMethod.Put} request on the {@link uri}. Sets {@link http!HttpHeader.IfMatch} if there is a cached {@link http!HttpHeader.ETag} to detect lost updates.
     * Caches the response if the server sends an {@link http!HttpHeader.ETag}, so later requests can be conditional without reading the resource again.
     * @param signal Used to cancel the request.
     * @throws {@link errors!ConcurrencyError}: The entity has changed since it was last retrieved with {@link getContent}. Your changes were rejected to prevent a lost update.
     * @throws {@link errors!BadRequestError}: {@link http!HttpStatusCode.BadRequest}
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    protected async putContent(content: any, signal?: AbortSignal): Promise<Response> {
        const contentType = this.serializer.supportedMediaTypes[0];
        const headers = new Headers();
        headers.append(HttpHeader.ContentType, contentType)
        if (this.responseCache?.eTag) headers.append(HttpHeader.IfMatch, this.responseCache.eTag);

        this.responseCache = undefined;
        const body = this.serializer.serialize(content);
        const response = await this.send(HttpMethod.Put, signal, headers, body);

        const eTag = response.headers.get(HttpHeader.ETag);
        if (eTag) {
            // Cache the response body if there is one. Otherwise cache the request body, since the ETag in a PUT response describes the representation that was sent (RFC 9110, section 9.3.4).
            const responseBody = await response.clone().text();
            this.responseCache = responseBody
                ? new ResponseCache(responseBody, response.headers.get(HttpHeader.ContentType) ?? undefined, eTag)
                : new ResponseCache(body, contentType, eTag);
        }

        return response;
    }

    /**
     * Performs an {@link http!HttpMethod.Delete} request on the {@link uri}. Sets {@link http!HttpHeader.IfMatch} if there is a cached {@link http!HttpHeader.ETag} to detect lost updates.
     * @param signal Used to cancel the request.
     * @throws {@link errors!ConcurrencyError}: The entity has changed since it was last retrieved with {@link getContent}. Your changes were rejected to prevent a lost update.
     * @throws {@link errors!BadRequestError}: {@link http!HttpStatusCode.BadRequest}
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    protected async deleteContent(signal?: AbortSignal): Promise<Response> {
        const headers = new Headers();
        if (this.responseCache?.eTag) headers.append(HttpHeader.IfMatch, this.responseCache.eTag);

        this.responseCache = undefined;
        return this.send(HttpMethod.Delete, signal, headers);
    }
}
