import type { DataTag, InfiniteData, QueryFunction, QueryFunctionContext, QueryKey } from "@tanstack/query-core";
import type { EntryEndpoint } from "typedrest/endpoints";
import { ElementEndpoint, GenericCollectionEndpoint, PartialResponse } from "typedrest/endpoints/generic";
import { RpcEndpointBase } from "typedrest/endpoints/rpc";
import { BlobEndpoint } from "typedrest/endpoints/raw";
import { RangeNotSatisfiableError } from "typedrest/errors";
import { operationKey } from "./keys";
import { adoptEndpoint } from "./registry";
import { recordVersion, shareVersioned } from "./versions";

/**
 * Query options created by this package. Pass them to `useQuery()`, `createQuery()`, `injectQuery()` or `queryClient.fetchQuery()`.
 * Spread them to add or override options: `useQuery({ ...readQuery(endpoint), staleTime: 5000 })`.
 * @typeParam TData The type of data the query returns.
 */
export interface EndpointQueryOptions<TData> {
    /** Hierarchical key derived from the endpoint's URL. See {@link endpointKey}. */
    queryKey: DataTag<QueryKey, TData, Error>;
    /** Calls the endpoint, passing TanStack's `signal` through for cancellation. */
    queryFn: QueryFunction<TData, QueryKey>;
    /** Keeps track of the version (ETag) the data was read from. See {@link versionOf}. */
    structuralSharing?: (oldData: unknown, newData: unknown) => unknown;
    /** Streaming queries default to `Infinity`, so they are not restarted when the window regains focus. */
    staleTime?: number;
}

/**
 * Infinite query options created by this package. Pass them to `useInfiniteQuery()`, `createInfiniteQuery()` or `queryClient.fetchInfiniteQuery()`.
 * @typeParam TEntity The type of individual elements.
 */
export interface EndpointInfiniteQueryOptions<TEntity> {
    queryKey: DataTag<QueryKey, InfiniteData<PartialResponse<TEntity>, number>, Error>;
    queryFn: QueryFunction<PartialResponse<TEntity>, QueryKey, number>;
    initialPageParam: number;
    getNextPageParam: (lastPage: PartialResponse<TEntity>) => number | undefined;
}

/**
 * Reads an element, using {@link ElementEndpoint.read}.
 * Refetches send the cached ETag, so unchanged data costs a `304 Not Modified` and does not cause a re-render.
 * @param endpoint The element to read.
 */
export function readQuery<TEntity>(endpoint: ElementEndpoint<TEntity>): EndpointQueryOptions<TEntity> {
    return {
        queryKey: operationKey<TEntity>(endpoint, "read"),
        queryFn: async ({ client, signal }: QueryFunctionContext) => {
            const shared = adoptEndpoint(client, endpoint);
            const entity = await shared.read(signal);
            recordVersion(entity, shared.responseCache, shared);
            return entity;
        },
        structuralSharing: shareVersioned
    };
}

/**
 * Checks whether an element exists, using {@link ElementEndpoint.exists}.
 * @param endpoint The element to check.
 */
export function existsQuery(endpoint: ElementEndpoint<unknown>): EndpointQueryOptions<boolean> {
    return {
        queryKey: operationKey<boolean>(endpoint, "exists"),
        queryFn: ({ client, signal }: QueryFunctionContext) => adoptEndpoint(client, endpoint).exists(signal)
    };
}

/**
 * Reads all elements of a collection, using {@link GenericCollectionEndpoint.readAll}.
 * @param endpoint The collection to read.
 */
export function readAllQuery<TEntity>(endpoint: GenericCollectionEndpoint<TEntity, ElementEndpoint<TEntity>>): EndpointQueryOptions<TEntity[]> {
    return {
        queryKey: operationKey<TEntity[]>(endpoint, "readAll"),
        queryFn: async ({ client, signal }: QueryFunctionContext) => {
            const shared = adoptEndpoint(client, endpoint);
            const entities = await shared.readAll(signal);
            recordVersion(entities, shared.responseCache, shared);
            return entities;
        },
        structuralSharing: shareVersioned
    };
}

/**
 * Reads a range of elements from a collection, using {@link GenericCollectionEndpoint.readRange}.
 * @param endpoint The collection to read.
 * @param from The index of the first element to return. Leave unspecified to return the last `to` elements ("tail").
 * @param to The index of the last element to return. Leave unspecified to return all elements starting at `from`.
 */
export function readRangeQuery<TEntity>(endpoint: GenericCollectionEndpoint<TEntity, ElementEndpoint<TEntity>>, from?: number, to?: number): EndpointQueryOptions<PartialResponse<TEntity>> {
    return {
        queryKey: operationKey<PartialResponse<TEntity>>(endpoint, "readRange", { from, to }),
        queryFn: ({ client, signal }: QueryFunctionContext) => adoptEndpoint(client, endpoint).readRange(from, to, signal)
    };
}

/**
 * Reads a collection page by page, using {@link GenericCollectionEndpoint.readRange}.
 * Stops when the server reports that the end of the collection has been reached.
 * @param endpoint The collection to read.
 * @param pageSize The number of elements per page.
 */
export function readRangeInfiniteQuery<TEntity>(endpoint: GenericCollectionEndpoint<TEntity, ElementEndpoint<TEntity>>, pageSize: number): EndpointInfiniteQueryOptions<TEntity> {
    if (!(pageSize > 0)) throw new Error("pageSize must be positive.");

    return {
        queryKey: operationKey<InfiniteData<PartialResponse<TEntity>, number>>(endpoint, "readRangeInfinite", { pageSize }),
        queryFn: async ({ client, signal, pageParam }: QueryFunctionContext<QueryKey, number>) => {
            try {
                return await adoptEndpoint(client, endpoint).readRange(pageParam, pageParam + pageSize - 1, signal);
            } catch (err) {
                // An empty collection or a page past the end
                if (err instanceof RangeNotSatisfiableError) return new PartialResponse<TEntity>([]);
                throw err;
            }
        },
        initialPageParam: 0,
        getNextPageParam: lastPage => (lastPage.endReached || lastPage.range?.to === undefined) ? undefined : lastPage.range.to + 1
    };
}

/** Capabilities of an RPC endpoint reported by the server. See {@link probeQuery}. */
export interface RpcCapabilities {
    /** Whether the server allows invoking the endpoint; `undefined` if it did not say. */
    invokeAllowed: boolean | undefined;
}

/** Capabilities of a blob endpoint reported by the server. See {@link probeQuery}. */
export interface BlobCapabilities {
    downloadAllowed: boolean | undefined;
    uploadAllowed: boolean | undefined;
    deleteAllowed: boolean | undefined;
}

/**
 * Asks the server which operations an endpoint currently allows, using `probe()`.
 * Returns a snapshot of the capabilities rather than the endpoint itself, so components re-render when they change.
 * @param endpoint The RPC or blob endpoint to probe.
 */
export function probeQuery(endpoint: RpcEndpointBase): EndpointQueryOptions<RpcCapabilities>;
export function probeQuery(endpoint: BlobEndpoint): EndpointQueryOptions<BlobCapabilities>;
export function probeQuery(endpoint: RpcEndpointBase | BlobEndpoint): EndpointQueryOptions<RpcCapabilities | BlobCapabilities> {
    return {
        queryKey: operationKey<RpcCapabilities | BlobCapabilities>(endpoint, "probe"),
        queryFn: async ({ client, signal }: QueryFunctionContext) => {
            const shared = adoptEndpoint(client, endpoint);
            await shared.probe(signal);
            return (shared instanceof BlobEndpoint)
                ? { downloadAllowed: shared.downloadAllowed, uploadAllowed: shared.uploadAllowed, deleteAllowed: shared.deleteAllowed }
                : { invokeAllowed: shared.invokeAllowed };
        }
    };
}

/**
 * Fetches meta data such as links from the server, using {@link EntryEndpoint.readMeta}.
 * Useful to wait for the links of an API before navigating it.
 * @param endpoint The entry endpoint.
 * @returns Query options whose data is always `null`.
 */
export function readMetaQuery(endpoint: EntryEndpoint): EndpointQueryOptions<null> {
    return {
        queryKey: operationKey<null>(endpoint, "readMeta"),
        queryFn: async ({ client, signal }: QueryFunctionContext) => {
            await adoptEndpoint(client, endpoint).readMeta(signal);
            return null;
        }
    };
}

/**
 * Downloads the content of a blob, using {@link BlobEndpoint.download}.
 * @param endpoint The blob to download.
 */
export function downloadQuery(endpoint: BlobEndpoint): EndpointQueryOptions<Blob> {
    return {
        queryKey: operationKey<Blob>(endpoint, "download"),
        queryFn: ({ client, signal }: QueryFunctionContext) => adoptEndpoint(client, endpoint).download(signal)
    };
}
