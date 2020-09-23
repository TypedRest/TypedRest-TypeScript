import { HttpMethod } from ".";

/**
 * HTTP client used to communicate with remote resources.
 */
export interface HttpClient {
    /**
     * Default HTTP headers to set for requests when not explicitly overridden.
     */
    defaultHeaders: Headers;

    /**
     * Sends an HTTP request.
     * @param uri The URI to send the message to.
     * @param method The HTTP method to use.
     * @param signal Used to cancel the request.
     * @param headers The HTTP headers to set.
     * @param body The body to send.
     */
    send(uri: URL, method: HttpMethod, signal?: AbortSignal, headers?: HeadersInit, body?: BodyInit): Promise<Response>;
}
