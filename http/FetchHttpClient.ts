import { HttpMethod } from "./HttpMethod";
import { HttpClient } from "./HttpClient";

/**
 * Communicates with remote resources using JavaScript's standard Fetch API.
 */
export class FetchHttpClient implements HttpClient {
    /**
     * @inheritDoc
     */
    defaultHeaders = new Headers();

    /**
     * @inheritDoc
     */
    send(uri: URL, method: HttpMethod, signal?: AbortSignal, headers?: HeadersInit, body?: BodyInit) {
        const mergedHeaders = new Headers(headers);
        this.defaultHeaders.forEach((value, key) => {
            if (!mergedHeaders.has(key)) {
                mergedHeaders.set(key, value);
            }
        });

        return fetch(uri.href, { method, signal, headers: mergedHeaders, body });
    }
}
