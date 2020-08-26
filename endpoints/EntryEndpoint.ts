import { Endpoint } from ".";
import { HttpMethod, HttpClient, FetchHttpClient, HttpHeader } from "../http";
import { Serializer, JsonSerializer } from "../serializers";
import { ErrorHandler, DefaultErrorHandler } from "../errors";
import { LinkExtractor, AggregateLinkExtractor, HeaderLinkExtractor, HalLinkExtractor } from "../links";

/**
 * Represent the top-level URI of an API. Derive from this class and add your own set of child-{@link Endpoint}s as properties.
 */
export class EntryEndpoint extends Endpoint {
    /**
     * Creates a new entry endpoint.
     * @param uri The base URI of the REST API. Missing trailing slash will be appended automatically
     * @param httpClient The HTTP client used to communicate with the REST API.
     * @param serializer Controls the serialization of entities sent to and received from the server. Defaults to {@link JsonSerializer} if unset.</param>
     * @param errorHandler Handles errors in HTTP responses. Defaults to {@link DefaultErrorHandler} if unset.</param>
     * @param linkExtractor Detects links in HTTP responses. Combines {@link HeaderLinkExtractor} and {@link HalLinkExtractor} if unset.</param>
     */
    constructor(
        uri: URL | string,
        httpClient?: HttpClient,
        serializer?: Serializer,
        errorHandler?: ErrorHandler,
        linkExtractor?: LinkExtractor) {
        super(undefined,
            Endpoint.ensureTrailingSlash(uri),
            httpClient ?? new FetchHttpClient(),
            serializer ?? new JsonSerializer(),
            errorHandler ?? new DefaultErrorHandler(),
            linkExtractor ?? new AggregateLinkExtractor(new HeaderLinkExtractor(), new HalLinkExtractor()));

        for (const mediaType of this.serializer.supportedMediaTypes) {
            this.httpClient.defaultHeaders.append(HttpHeader.Accept, mediaType);
        }
    }

    /**
     * Fetches meta data such as links from the server.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async readMeta() { await this.send(HttpMethod.Get); }
}
