// NOTE: TanStack still marks streamedQuery as experimental, so its options may change in a minor release.
import { experimental_streamedQuery as streamedQuery, type QueryFunctionContext } from "@tanstack/query-core";
import type { ElementEndpoint } from "typedrest/endpoints/generic";
import type { GenericStreamingCollectionEndpoint, PollingEndpoint, SseStreamingEndpoint, StreamingEndpoint } from "typedrest/endpoints/reactive";
import { operationKey } from "./keys";
import type { EndpointQueryOptions } from "./queries";

/**
 * Defines how a stream query handles refetches, e.g. after `refetch()`.
 * - `reset` (default): clears the data and starts over.
 * - `append`: keeps the data and appends what the new stream delivers.
 * - `replace`: keeps the old data until the new stream has ended, then replaces it.
 */
export type RefetchMode = "reset" | "append" | "replace";

/**
 * Options for {@link streamQuery} that fold the stream into a custom data shape.
 */
export interface StreamReducerOptions<TEntity, TData> {
    /** Combines the data so far with the next element of the stream. */
    reducer: (data: TData, entity: TEntity) => TData;
    /** The data before the first element arrives. */
    initialValue: TData;
    /** How to handle refetches. */
    refetchMode?: RefetchMode;
}

// NOTE: Streams read TanStack's signal, so TanStack aborts them when the query is canceled or its last observer unsubscribes.

/**
 * Streams elements from a persistent HTTP connection or Server-Sent Events, using `stream()`.
 * By default, `data` is an array of all elements received so far.
 * The connection is closed when the query is canceled or no longer used.
 * Defaults to `staleTime: Infinity`, so the stream is not restarted when the window regains focus.
 * @param endpoint The streaming endpoint.
 * @param options How to handle refetches.
 */
export function streamQuery<TEntity>(endpoint: StreamingEndpoint<TEntity> | SseStreamingEndpoint<TEntity>, options?: { refetchMode?: RefetchMode; }): EndpointQueryOptions<TEntity[]>;
/**
 * Streams elements from a persistent HTTP connection or Server-Sent Events, using `stream()`, folding them into a custom data shape.
 * @param endpoint The streaming endpoint.
 * @param options How to combine elements into `data`, and how to handle refetches.
 */
export function streamQuery<TEntity, TData>(endpoint: StreamingEndpoint<TEntity> | SseStreamingEndpoint<TEntity>, options: StreamReducerOptions<TEntity, TData>): EndpointQueryOptions<TData>;
export function streamQuery<TEntity, TData>(endpoint: StreamingEndpoint<TEntity> | SseStreamingEndpoint<TEntity>, options?: Partial<StreamReducerOptions<TEntity, TData>>): EndpointQueryOptions<TData> {
    const streamFn = ({ signal }: QueryFunctionContext) => endpoint.stream(signal);
    return {
        queryKey: operationKey<TData>(endpoint, "stream"),
        queryFn: (options?.reducer)
            ? streamedQuery<TEntity, TData>({ streamFn, reducer: options.reducer, initialValue: options.initialValue as TData, refetchMode: options.refetchMode })
            : streamedQuery<TEntity, TData>({ streamFn, refetchMode: options?.refetchMode } as Parameters<typeof streamedQuery<TEntity, TData>>[0]),
        staleTime: Infinity
    };
}

/**
 * Streams the elements of an append-only collection, polling for new ones, using {@link GenericStreamingCollectionEndpoint.stream}.
 * `data` is an array of all elements received so far.
 * Polling stops when the query is canceled or no longer used.
 * @param endpoint The streaming collection.
 * @param startIndex The index of the first element to return. Use a negative value to start with the last `-startIndex` elements ("tail").
 */
export function streamCollectionQuery<TEntity>(endpoint: GenericStreamingCollectionEndpoint<TEntity, ElementEndpoint<TEntity>>, startIndex: number = 0): EndpointQueryOptions<TEntity[]> {
    return {
        queryKey: operationKey<TEntity[]>(endpoint, "streamCollection", { startIndex }),
        queryFn: streamedQuery<TEntity, TEntity[]>({ streamFn: ({ signal }: QueryFunctionContext) => endpoint.stream(startIndex, signal) }),
        staleTime: Infinity
    };
}

/**
 * Polls an element for state changes, using {@link PollingEndpoint.stream}.
 * `data` is the most recent state. Respects the server's `Retry-After` header and the endpoint's end condition.
 * Polling stops when the query is canceled or no longer used.
 * @param endpoint The polling endpoint.
 */
export function pollQuery<TEntity>(endpoint: PollingEndpoint<TEntity>): EndpointQueryOptions<TEntity> {
    return {
        queryKey: operationKey<TEntity>(endpoint, "poll"),
        queryFn: streamedQuery<TEntity, TEntity>({
            streamFn: ({ signal }: QueryFunctionContext) => endpoint.stream(signal),
            reducer: (_: TEntity, entity: TEntity) => entity,
            // NOTE: Only returned if the query is canceled before the first poll, in which case TanStack discards it
            initialValue: undefined as TEntity
        }),
        staleTime: Infinity
    };
}
