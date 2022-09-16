import { HttpMethod, HttpHeader, HttpClient } from "../http";
import { Serializer } from "../serializers";
import { ErrorHandler, NotFoundError } from "../errors";
import { LinkExtractor, Link } from "../links";
import { parseTemplate } from 'url-template';

export class Endpoint {
    /**
     * The HTTP URI of the remote resource.
     */
    readonly uri: URL;

    /**
     * The HTTP client used to communicate with the remote resource.
     */
    readonly httpClient: HttpClient;

    /**
     * Controls the serialization of entities sent to and received from the server.
     */
    readonly serializer: Serializer;

    /**
     * Handles errors in responses.
     */
    readonly errorHandler: ErrorHandler;

    /**
     * Extracts links from responses.
     */
    readonly linkExtractor: LinkExtractor;

    /**
     * Creates a new endpoint.
     * @param referrer The endpoint used to navigate to this one. Must be defined except for top-level endpoint.
     * @param uri The HTTP URI of the remote element. May be relative if `referrer` is defined.
     * @param serializer Controls the serialization of entities sent to and received from the server. Taken from `referrer` instead if it is defined.
     * @param errorHandler Handles errors in responses. Taken from `referrer` instead if it is defined.
     * @param linkExtractor Extracts links from responses. Taken from `referrer` instead if it is defined.
     * @param httpClient The HTTP client used to communicate with the remote resource. Taken from `referrer` instead if it is defined.
     */
    constructor(
        referrer: Endpoint | undefined,
        uri: URL | string,
        serializer?: Serializer,
        errorHandler?: ErrorHandler,
        linkExtractor?: LinkExtractor,
        httpClient?: HttpClient) {
        if (referrer) {
            this.uri = (typeof uri === "string") ? referrer.join(uri) : uri;
            if (serializer)
                throw new Error("serializer must not be specified if referrer is not specified.");
            this.serializer = referrer.serializer;
            if (errorHandler)
                throw new Error("errorHandler must not be specified if referrer is not specified.");
            this.errorHandler = referrer.errorHandler;
            if (linkExtractor)
                throw new Error("linkExtractor must not be specified if referrer is not specified.");
            this.linkExtractor = referrer.linkExtractor;
            if (httpClient)
                throw new Error("httpClient must not be specified if referrer is not specified.");
            this.httpClient = referrer.httpClient;
        } else {
            this.uri = (typeof uri === "string") ? new URL(uri) : uri;
            if (!serializer)
                throw new Error("serializer must be specified if referrer is not specified.");
            this.serializer = serializer;
            if (!errorHandler)
                throw new Error("errorHandler must be specified if referrer is not specified.");
            this.errorHandler = errorHandler;
            if (!linkExtractor)
                throw new Error("linkExtractor must be specified if referrer is not specified.");
            this.linkExtractor = linkExtractor;
            if (!httpClient)
                throw new Error("httpClient must be specified if referrer is not specified.");
            this.httpClient = httpClient;
        }
    }

    /**
     * Resolves a relative URI using this endpoint's URI as the base.
     * @param relativeUri The relative URI to resolve. Prepend `./` to imply a trailing slash in the base URI even if it is missing there.
     */
    protected join(relativeUri: string): URL {
        return new URL(
            relativeUri,
            relativeUri.startsWith("./") ? Endpoint.ensureTrailingSlash(this.uri) : this.uri);
    }

    /**
     * Adds a trailing slash to the URI if it does not already have one.
     */
    protected static ensureTrailingSlash(uri: URL | string): URL {
        let uriString = (typeof uri === "string") ? uri : uri.href;
        if (uriString.substr(uriString.length - 1, 1) !== "/")
            uriString += "/";
        return new URL(uriString);
    }

    /**
     * Sends an HTTP request to this endpoint's URI.
     * Handles various cross-cutting concerns regarding a response message such as discovering links and handling errors.
     * @param method The HTTP method to use.
     * @param signal Used to cancel the request.
     * @param headers The HTTP headers to set.
     * @param body The body to send.
     * @throws {@link errors!HttpError}
     */
    protected async send(method: HttpMethod, signal?: AbortSignal, headers?: HeadersInit, body?: BodyInit): Promise<Response> {
        const response = await this.httpClient.send(this.uri, method, signal, headers, body);
        await this.handle(response);
        return response;
    }

    /**
     * Handles various cross-cutting concerns regarding a response message such as discovering links and handling errors.
     * @param response The response to process.
     * @throws {@link errors!HttpError}
     */
    protected async handle(response: Response) {
        this.links = await this.linkExtractor.getLinks(response);
        this.handleCapabilities(response);
        await this.errorHandler.handle(response);
    }

    // NOTE: Always replace entire array rather than modifying it to avoid async issues.
    private links: Link[] = [];

    // NOTE: Only modified during initial setup of the endpoint.
    private defaultLinks = new Map<string, URL>();
    private defaultLinkTemplates = new Map<string, string>();

    /**
     * Registers one or more default links for a specific relation type.
     * These links are used when no links with this relation type are provided by the server.
     * This should only be called during initial setup of the endpoint.
     * @param rel The relation type of the link to add.
     * @param href The href of the link relative to this endpoint's URI. Leave unspecified to remove any previous entries for the relation type.
     */
    setDefaultLink(rel: string, href?: string) {
        if (href) {
            this.defaultLinks.set(rel, this.join(href));
        } else {
            this.defaultLinks.delete(rel);
        }
    }

    /**
     * Registers a default link template for a specific relation type.
     * This template is used when no template with this relation type is provided by the server.
     * This should only be called during initial setup of the endpoint.
     * @param rel The relation type of the link to add.
     * @param href The templates href relative to this endpoint's URI. Leave unspecified to remove any previous entries for the relation type.
     */
    setDefaultLinkTemplate(rel: string, href?: string) {
        if (href) {
            this.defaultLinkTemplates.set(rel, href);
        } else {
            this.defaultLinkTemplates.delete(rel);
        }
    }

    /**
     * Resolves all links with a specific relation type. Uses cached data from last response.
     * @param rel The relation type of the links to look for.
     */
    getLinks(rel: string): { uri: URL; title?: string; }[] {
        const links: { uri: URL; title?: string; }[] = this.links
            .filter(x => !x.templated && x.rel === rel)
            .map(x => {
                return { uri: this.join(x.href), title: x.title };
            });

        const defaultLink = this.defaultLinks.get(rel);
        if (links.length === 0 && defaultLink) {
            links.push({ uri: defaultLink });
        }

        return links;
    }

    /**
     * Resolves a single link with a specific relation type. Uses cached data from last response.
     * @param rel The relation type of the link to look for.
     * @throws {@link errors!NotFoundError}: No link with the specified `rel` could be found.
     */
    link(rel: string): URL {
        const links = this.getLinks(rel);

        if (links.length === 0)
            throw new NotFoundError(`No link with rel=${rel} provided by endpoint ${this.uri}.`, 0);

        return links[0].uri;
    }

    /**
     * Resolves a link template with a specific relation type. Uses cached data from last response.
     * @param rel The relation type of the link template to look for.
     * @param variables Variables for resolving the template.
     * @throws {@link errors!NotFoundError}: No link template with the specified `rel` could be found.
     */
    linkTemplate(rel: string, variables: { [key: string]: any; }): URL {
        const tmpl = parseTemplate(this.getLinkTemplate(rel))
        return new URL(this.join(tmpl.expand(variables)))
    }

    /**
     * Retrieves a link template with a specific relation type. Uses cached data from last response. Prefer {@link linkTemplate} when possible.
     * @param rel The relation type of the link template to look for.
     * @throws {@link errors!NotFoundError}: No link template with the specified `rel` could be found.
     */
    getLinkTemplate(rel: string) {
        const template = this.links.find(x => x.templated && x.rel === rel)?.href
            ?? this.defaultLinkTemplates.get(rel);

        if (!template)
            throw new NotFoundError(`No link template with rel=${rel} provided by endpoint ${this.uri}.`, 0);

        return template;
    }

    // NOTE: Always replace entire array rather than modifying it to avoid async issues.
    private allowedMethods: HttpMethod[] = [];

    /**
     * Handles allowed HTTP methods and other capabilities reported by the server.
     */
    protected handleCapabilities(response: Response) {
        const header = response.headers.get(HttpHeader.Allow);
        if (header) {
            this.allowedMethods = header.split(", ") as HttpMethod[];
        }
    }

    /**
     * Shows whether the server has indicated that a specific HTTP method is currently allowed.
     * Uses cached data from last response.
     * @param method The HTTP methods (e.g. GET, POST, ...) to check.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    protected isMethodAllowed(method: HttpMethod): boolean | undefined {
        if (this.allowedMethods.length === 0)
            return undefined;

        return this.allowedMethods.indexOf(method) !== -1;
    }
}
