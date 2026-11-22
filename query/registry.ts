import type { QueryClient } from "@tanstack/query-core";
import type { Endpoint } from "typedrest/endpoints";
import type { HttpClient } from "typedrest/http";
import { endpointKey, parseKey } from "./keys";

// Shared endpoint instances per query client, keyed by HTTP client, endpoint class and URL.
// NOTE: Uses a Map rather than a WeakMap for HTTP clients so entries can be enumerated for eviction.
type Registry = Map<HttpClient, Map<Function, Map<string, Endpoint>>>;

const registries = new WeakMap<QueryClient, Registry>();

function registryFor(client: QueryClient): Registry {
    let registry = registries.get(client);
    if (!registry) {
        const newRegistry: Registry = new Map();
        registry = newRegistry;
        registries.set(client, registry);

        // Drop shared instances once TanStack has removed every query for their URL
        client.getQueryCache().subscribe(event => {
            if (event.type !== "removed") return;
            const removed = parseKey(event.query.queryKey);
            if (!removed) return;
            const samePath = (path: readonly string[]) => path.length === removed.path.length && path.every((segment, i) => segment === removed.path[i]);
            if (client.getQueryCache().findAll({ predicate: q => { const parsed = parseKey(q.queryKey); return !!parsed && samePath(parsed.path); } }).length > 0) return;

            for (const [httpClient, byClass] of newRegistry) {
                for (const [type, byUri] of byClass) {
                    for (const [uri, endpoint] of byUri) {
                        if (samePath(endpointKey(endpoint))) byUri.delete(uri);
                    }
                    if (byUri.size === 0) byClass.delete(type);
                }
                if (byClass.size === 0) newRegistry.delete(httpClient);
            }
        });
    }
    return registry;
}

function entriesFor(client: QueryClient, endpoint: Endpoint, create: boolean): Map<string, Endpoint> | undefined {
    const registry = registryFor(client);

    let byClass = registry.get(endpoint.httpClient);
    if (!byClass) {
        if (!create) return undefined;
        byClass = new Map();
        registry.set(endpoint.httpClient, byClass);
    }

    let byUri = byClass.get(endpoint.constructor);
    if (!byUri) {
        if (!create) return undefined;
        byUri = new Map();
        byClass.set(endpoint.constructor, byUri);
    }

    return byUri;
}

/**
 * Returns the endpoint instance this package uses for queries and mutations on the same URL as `endpoint`.
 *
 * TypedRest keeps ETags and capabilities (such as `setAllowed`) on endpoint objects.
 * This package shares one instance per query client, HTTP client, endpoint class and URL, so you may create endpoints freely (e.g. on every render).
 * Use this function to read state such as `setAllowed` or `responseCache` from that shared instance.
 * @param client The query client.
 * @param endpoint Any endpoint instance for the URL.
 * @returns The shared instance, or `endpoint` itself if no query has used this URL yet.
 */
export function endpointFor<TEndpoint extends Endpoint>(client: QueryClient, endpoint: TEndpoint): TEndpoint {
    return (entriesFor(client, endpoint, false)?.get(endpoint.uri.href) as TEndpoint | undefined) ?? endpoint;
}

/**
 * Like {@link endpointFor}, but registers `endpoint` as the shared instance if there is none yet.
 * Only call this when a query for the endpoint exists or is about to be created, so the entry can be evicted again.
 */
export function adoptEndpoint<TEndpoint extends Endpoint>(client: QueryClient, endpoint: TEndpoint): TEndpoint {
    const entries = entriesFor(client, endpoint, true)!;
    const existing = entries.get(endpoint.uri.href) as TEndpoint | undefined;
    if (existing) return existing;

    entries.set(endpoint.uri.href, endpoint);
    return endpoint;
}
