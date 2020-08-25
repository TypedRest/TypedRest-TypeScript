import { HttpMethod, HttpClient } from ".";

/**
 * Communicates with remote resources using JavaScript's standard Fetch API.
 */
export class FetchHttpClient implements HttpClient {
    /**
     * @inheritdoc
     */
    defaultHeaders = new Headers();

    /**
     * @inheritdoc
     */
    send(uri: URL, method: HttpMethod, headers?: HeadersInit, body?: BodyInit): Promise<Response> {
        const mergedHeaders = new Headers(headers);
        this.defaultHeaders.forEach((value, key) => {
            if (!mergedHeaders.has(key)) {
                mergedHeaders.set(key, value);
            }
        });

        return fetch(uri.href, { method, headers: mergedHeaders, body });
    }
}
