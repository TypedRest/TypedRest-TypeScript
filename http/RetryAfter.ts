import { HttpHeader } from "./HttpHeader";

/**
 * Extracts the delay a server has asked clients to wait for before retrying a request.
 * @param response The response to read the {@link HttpHeader.RetryAfter} header from.
 * @returns The delay in milliseconds; `undefined` if the response has no (valid) header.
 */
export function retryAfter(response: Response): number | undefined {
    const header = response.headers.get(HttpHeader.RetryAfter)?.trim();
    if (!header) return undefined;

    // Either a number of seconds ...
    if (/^\d+$/.test(header)) return parseInt(header) * 1000;

    // ... or an absolute point in time
    const date = Date.parse(header);
    if (Number.isNaN(date)) return undefined;
    return Math.max(0, date - Date.now());
}
