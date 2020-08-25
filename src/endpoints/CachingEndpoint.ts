import { ResponseCache } from "../http";

/**
 * Endpoint that caches the last response.
 */
export interface CachingEndpoint {
    /**
     * A cached copy of the last response.
     */
    responseCache?: ResponseCache;
}
