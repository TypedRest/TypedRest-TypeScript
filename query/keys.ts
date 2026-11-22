import type { DataTag, QueryClient, QueryKey } from "@tanstack/query-core";
import type { Endpoint } from "typedrest/endpoints";

/**
 * The last element of every query and mutation key created by this package.
 * Identifies the TypedRest operation and its arguments.
 */
export interface OperationKey {
    /** The name of the operation, e.g. `read` or `readRange`. */
    readonly typedrest: string;
    readonly [argument: string]: unknown;
}

/**
 * Returns the hierarchical part of the query keys for an endpoint: the origin followed by the URL's path segments.
 * A query string becomes one more segment, so filtered views are children of the unfiltered resource.
 *
 * Keys for an endpoint start with the keys of the endpoints above it in the URL tree,
 * so invalidating `endpointKey(collection)` also invalidates the queries of its elements and their children.
 * @param endpoint The endpoint or URL to get the key for.
 * @example
 * endpointKey(client.contacts.get("1")) // ["https://api.example.com", "contacts", "1"]
 */
export function endpointKey(endpoint: Endpoint | URL): string[] {
    const uri = endpoint instanceof URL ? endpoint : endpoint.uri;
    const key = [uri.origin, ...uri.pathname.split("/").filter(segment => segment !== "")];
    if (uri.search) key.push(uri.search);
    return key;
}

/**
 * Returns the query key for a specific operation on an endpoint, tagged with the type of data it returns.
 * @param endpoint The endpoint the operation is performed on.
 * @param operation The name of the operation, e.g. `read`.
 * @param args Arguments that distinguish different calls of the same operation, e.g. a range.
 */
export function operationKey<TData>(endpoint: Endpoint, operation: string, args?: Record<string, unknown>): DataTag<QueryKey, TData, Error> {
    const key: unknown[] = [...endpointKey(endpoint), { ...args, typedrest: operation }];
    return key as unknown as DataTag<QueryKey, TData, Error>;
}

/**
 * Splits a key created by this package into the endpoint path and the operation.
 * @returns `undefined` if the key was not created by this package.
 */
export function parseKey(key: QueryKey): { path: string[]; operation: string; } | undefined {
    const last = key[key.length - 1] as Partial<OperationKey> | undefined;
    if (!last || typeof last !== "object" || typeof last.typedrest !== "string") return undefined;

    const path = key.slice(0, -1);
    if (path.length === 0 || !path.every(segment => typeof segment === "string")) return undefined;

    return { path: path as string[], operation: last.typedrest };
}

/**
 * Selects which queries to invalidate relative to an endpoint.
 * - `self`: queries on the endpoint itself.
 * - `subtree`: the endpoint and everything below it (e.g. a collection and its elements).
 * - `ancestors`: the endpoint and everything above it (e.g. an element, its collection and the entry endpoint).
 * - `lineage`: `ancestors` and `subtree` combined, leaving out siblings.
 * - `parent`: the subtree of the endpoint's parent (e.g. everything an RPC call on an element may have changed).
 */
export type InvalidateScope = "self" | "subtree" | "ancestors" | "lineage" | "parent";

function isPrefix(prefix: readonly string[], path: readonly string[]) {
    return prefix.length <= path.length && prefix.every((segment, i) => segment === path[i]);
}

/**
 * Determines whether a query path lies within a scope relative to a target path.
 */
export function inScope(scope: InvalidateScope, target: readonly string[], path: readonly string[]): boolean {
    switch (scope) {
        case "self": return target.length === path.length && isPrefix(target, path);
        case "subtree": return isPrefix(target, path);
        case "ancestors": return isPrefix(path, target);
        case "lineage": return isPrefix(target, path) || isPrefix(path, target);
        case "parent": return isPrefix(target.length > 1 ? target.slice(0, -1) : target, path);
    }
}

/**
 * Operations that keep a connection or polling loop open.
 * Invalidating them would restart the stream, and they pick up changes on their own, so they are left out of automatic invalidation.
 */
export const streamingOperations: ReadonlySet<string> = new Set(["stream", "streamCollection", "poll"]);

/**
 * Invalidates the queries created by this package for an endpoint and the endpoints around it.
 * Streaming queries are not invalidated, since they pick up changes on their own.
 * @param client The query client holding the queries.
 * @param endpoint The endpoint to invalidate relative to.
 * @param scope Which queries to invalidate relative to `endpoint`.
 */
export function invalidateEndpoint(client: QueryClient, endpoint: Endpoint, scope: InvalidateScope = "subtree"): Promise<void> {
    const target = endpointKey(endpoint);
    return client.invalidateQueries({
        predicate: query => {
            const parsed = parseKey(query.queryKey);
            return !!parsed && !streamingOperations.has(parsed.operation) && inScope(scope, target, parsed.path);
        }
    });
}

/**
 * Removes all queries for an endpoint and the endpoints below it, including streaming queries.
 */
export function removeEndpointQueries(client: QueryClient, endpoint: Endpoint) {
    const target = endpointKey(endpoint);
    client.removeQueries({
        predicate: query => {
            const parsed = parseKey(query.queryKey);
            return !!parsed && inScope("subtree", target, parsed.path);
        }
    });
}
