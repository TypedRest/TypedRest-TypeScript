import type { MutationFunctionContext, MutationKey, QueryClient } from "@tanstack/query-core";
import type { Endpoint } from "typedrest/endpoints";
import type { ElementEndpoint, GenericCollectionEndpoint } from "typedrest/endpoints/generic";
import { ActionEndpoint, ProducerEndpoint, type ConsumerEndpoint, type FunctionEndpoint } from "typedrest/endpoints/rpc";
import { BlobEndpoint, type UploadEndpoint } from "typedrest/endpoints/raw";
import type { ResponseCache } from "typedrest/http";
import { endpointKey, invalidateEndpoint, operationKey, removeEndpointQueries, type InvalidateScope } from "./keys";
import { adoptEndpoint, endpointFor } from "./registry";
import { recordVersion } from "./versions";

/**
 * Mutation options created by this package. Pass them to `useMutation()`, `createMutation()` or `injectMutation()`.
 * Spread them to add callbacks: `useMutation({ ...setMutation(endpoint), onSuccess: () => navigate("/") })`.
 * Invalidation happens inside `mutationFn`, so your own `onSuccess` does not replace it.
 * Errors from TypedRest, such as `ConcurrencyError`, are passed through unchanged as the mutation's `error`.
 * @typeParam TData The type of data the mutation returns.
 * @typeParam TVariables The type of the variables passed to `mutate()`.
 */
export interface EndpointMutationOptions<TData, TVariables> {
    /** The endpoint's key followed by the operation, e.g. for `useMutationState()`. */
    mutationKey: MutationKey;
    /** Calls the endpoint, then updates and invalidates affected queries. */
    mutationFn: (variables: TVariables, context: MutationFunctionContext) => Promise<TData>;
}

/**
 * Controls which queries a mutation invalidates after it succeeds.
 */
export interface InvalidateOptions {
    /** Which queries to invalidate relative to the endpoint, or `false` for none. Each mutation helper documents its default. */
    invalidate?: InvalidateScope | false;
    /** Additional endpoints whose subtrees to invalidate, e.g. a list that shows the changed element elsewhere in the API. */
    alsoInvalidate?: readonly Endpoint[];
}

/**
 * Options for mutations that support optimistic concurrency.
 */
export interface ConcurrencyOptions {
    /**
     * The version the change is based on, usually captured with {@link versionOf} when the user started editing.
     * The server rejects the change with a `ConcurrencyError` if the resource has changed since, even if the query has refetched in the meantime.
     * Leave unspecified to use the version from the most recent request.
     */
    basedOn?: ResponseCache;
}

async function invalidate(client: QueryClient, endpoint: Endpoint, defaultScope: InvalidateScope, options?: InvalidateOptions) {
    const scope = options?.invalidate ?? defaultScope;
    const tasks: Promise<void>[] = [];
    if (scope !== false) tasks.push(invalidateEndpoint(client, endpoint, scope));
    for (const other of options?.alsoInvalidate ?? []) tasks.push(invalidateEndpoint(client, other, "subtree"));
    await Promise.all(tasks);
}

function mutationKey(endpoint: Endpoint, operation: string): MutationKey {
    return [...endpointKey(endpoint), { typedrest: operation }];
}

/**
 * Puts an entity the server returned into the element's `read` query, if there is one.
 */
function seed<TEntity>(client: QueryClient, endpoint: ElementEndpoint<TEntity>, entity: TEntity | undefined, version: ResponseCache | undefined) {
    if (entity === undefined) return;
    const key = operationKey<TEntity>(endpoint, "read");
    if (!client.getQueryState(key)) return;

    recordVersion(entity, version);
    client.setQueryData(key, entity);
}

/**
 * Replaces an element, using {@link ElementEndpoint.set}.
 * Sends the ETag of the version the change is based on, so the server can reject lost updates with a `ConcurrencyError`.
 * Invalidates `lineage` by default.
 * @param endpoint The element to replace.
 * @param options Optimistic concurrency and invalidation options.
 */
export function setMutation<TEntity>(endpoint: ElementEndpoint<TEntity>, options?: ConcurrencyOptions & InvalidateOptions): EndpointMutationOptions<TEntity | undefined, TEntity> {
    return {
        mutationKey: mutationKey(endpoint, "set"),
        mutationFn: async (entity, { client }) => {
            const shared = endpointFor(client, endpoint);
            const result = await shared.set(entity, undefined, options?.basedOn);
            seed(client, shared, result, shared.responseCache);
            await invalidate(client, shared, "lineage", options);
            return result;
        }
    };
}

/**
 * Changes some fields of an element, using {@link ElementEndpoint.merge}.
 * Does not detect lost updates; use {@link setMutation} or {@link updateMutation} for that.
 * Invalidates `lineage` by default.
 * @param endpoint The element to modify.
 * @param options Invalidation options.
 */
export function mergeMutation<TEntity>(endpoint: ElementEndpoint<TEntity>, options?: InvalidateOptions): EndpointMutationOptions<TEntity | undefined, Partial<TEntity>> {
    return {
        mutationKey: mutationKey(endpoint, "merge"),
        mutationFn: async (entity, { client }) => {
            const shared = endpointFor(client, endpoint);
            const result = await shared.merge(entity);
            seed(client, shared, result, undefined);
            await invalidate(client, shared, "lineage", options);
            return result;
        }
    };
}

/**
 * Reads the current state of an element, applies a change and stores the result, retrying on conflicts, using {@link ElementEndpoint.update}.
 * Invalidates `lineage` by default.
 * @param endpoint The element to update.
 * @param options The maximum number of retries and invalidation options.
 * @returns Mutation options whose variables are the function that applies the change.
 */
export function updateMutation<TEntity>(endpoint: ElementEndpoint<TEntity>, options?: { maxRetries?: number; } & InvalidateOptions): EndpointMutationOptions<TEntity | undefined, (entity: TEntity) => void> {
    return {
        mutationKey: mutationKey(endpoint, "update"),
        mutationFn: async (updateAction, { client }) => {
            const shared = endpointFor(client, endpoint);
            const result = await shared.update(updateAction, options?.maxRetries);
            seed(client, shared, result, shared.responseCache);
            await invalidate(client, shared, "lineage", options);
            return result;
        }
    };
}

/**
 * Deletes an element, using {@link ElementEndpoint.delete}.
 * Sends the ETag of the version the deletion is based on, so the server can reject it with a `ConcurrencyError` if someone else changed the element.
 * Removes the queries of the element and everything below it, then invalidates `ancestors` by default.
 * @param endpoint The element to delete.
 * @param options Optimistic concurrency and invalidation options.
 */
export function deleteMutation(endpoint: ElementEndpoint<unknown>, options?: ConcurrencyOptions & InvalidateOptions): EndpointMutationOptions<void, void> {
    return {
        mutationKey: mutationKey(endpoint, "delete"),
        mutationFn: async (_, { client }) => {
            const shared = endpointFor(client, endpoint);
            await shared.delete(undefined, options?.basedOn);
            removeEndpointQueries(client, shared);
            await invalidate(client, shared, "ancestors", options);
        }
    };
}

/**
 * Adds an element to a collection, using {@link GenericCollectionEndpoint.create}.
 * If the server returns the new element, it is put into the cache for the element's {@link readQuery}, including its ETag.
 * Invalidates `ancestors` of the collection by default (the collection and everything above it, but not its other elements).
 * @param endpoint The collection to add to.
 * @param options Invalidation options.
 * @returns Mutation options whose data is the endpoint for the new element, or `undefined` if the server did not say where it is.
 */
export function createMutation<TEntity, TElementEndpoint extends ElementEndpoint<TEntity>>(endpoint: GenericCollectionEndpoint<TEntity, TElementEndpoint>, options?: InvalidateOptions): EndpointMutationOptions<TElementEndpoint | undefined, TEntity> {
    return {
        mutationKey: mutationKey(endpoint, "create"),
        mutationFn: async (entity, { client }) => {
            const shared = endpointFor(client, endpoint);
            let created = await shared.create(entity);

            const response = created?.response;
            if (created && response !== undefined) {
                // Share the new endpoint, so its cached ETag is used for later changes
                const adopted = adoptEndpoint(client, created);
                if (adopted !== created) adopted.responseCache = created.responseCache;
                created = adopted;

                recordVersion(response, created.responseCache);
                client.setQueryData(operationKey<TEntity>(created, "read"), response);
            }

            await invalidate(client, shared, "ancestors", options);
            return created;
        }
    };
}

/**
 * Adds or updates multiple elements in a collection, using {@link GenericCollectionEndpoint.createAll}.
 * Invalidates the collection's `subtree` by default.
 * @param endpoint The collection to add to.
 * @param options Invalidation options.
 */
export function createAllMutation<TEntity>(endpoint: GenericCollectionEndpoint<TEntity, ElementEndpoint<TEntity>>, options?: InvalidateOptions): EndpointMutationOptions<void, TEntity[]> {
    return {
        mutationKey: mutationKey(endpoint, "createAll"),
        mutationFn: async (entities, { client }) => {
            const shared = endpointFor(client, endpoint);
            await shared.createAll(entities);
            await invalidate(client, shared, "subtree", options);
        }
    };
}

/**
 * Replaces the entire content of a collection, using {@link GenericCollectionEndpoint.setAll}.
 * Invalidates the collection's `subtree` by default.
 * @param endpoint The collection to replace.
 * @param options Optimistic concurrency and invalidation options.
 */
export function setAllMutation<TEntity>(endpoint: GenericCollectionEndpoint<TEntity, ElementEndpoint<TEntity>>, options?: ConcurrencyOptions & InvalidateOptions): EndpointMutationOptions<void, TEntity[]> {
    return {
        mutationKey: mutationKey(endpoint, "setAll"),
        mutationFn: async (entities, { client }) => {
            const shared = endpointFor(client, endpoint);
            await shared.setAll(entities, undefined, options?.basedOn);
            await invalidate(client, shared, "subtree", options);
        }
    };
}

/**
 * Invokes an RPC endpoint.
 * The server may have changed anything around the endpoint, so this invalidates the `parent`'s subtree by default.
 * @param endpoint The RPC endpoint to invoke.
 * @param options Invalidation options.
 */
export function invokeMutation<TEntity, TResult>(endpoint: FunctionEndpoint<TEntity, TResult>, options?: InvalidateOptions): EndpointMutationOptions<TResult, TEntity>;
export function invokeMutation<TEntity>(endpoint: ConsumerEndpoint<TEntity>, options?: InvalidateOptions): EndpointMutationOptions<void, TEntity>;
export function invokeMutation<TResult>(endpoint: ProducerEndpoint<TResult>, options?: InvalidateOptions): EndpointMutationOptions<TResult, void>;
export function invokeMutation(endpoint: ActionEndpoint, options?: InvalidateOptions): EndpointMutationOptions<void, void>;
export function invokeMutation(endpoint: ActionEndpoint | ConsumerEndpoint<unknown> | FunctionEndpoint<unknown, unknown> | ProducerEndpoint<unknown>, options?: InvalidateOptions): EndpointMutationOptions<any, any> {
    return {
        mutationKey: mutationKey(endpoint, "invoke"),
        mutationFn: async (variables, { client }) => {
            const shared = endpointFor(client, endpoint);
            const result = (shared instanceof ActionEndpoint || shared instanceof ProducerEndpoint)
                ? await shared.invoke()
                : await (shared as ConsumerEndpoint<unknown> | FunctionEndpoint<unknown, unknown>).invoke(variables);
            await invalidate(client, shared, "parent", options);
            return result;
        }
    };
}

/**
 * Uploads data to a blob or upload endpoint, using `uploadFrom()`.
 * Invalidates `lineage` for blob endpoints and the `parent`'s subtree for upload endpoints by default.
 * @param endpoint The endpoint to upload to.
 * @param options Invalidation options.
 */
export function uploadMutation(endpoint: BlobEndpoint | UploadEndpoint, options?: InvalidateOptions): EndpointMutationOptions<void, Blob> {
    return {
        mutationKey: mutationKey(endpoint, "upload"),
        mutationFn: async (blob, { client }) => {
            const shared = endpointFor(client, endpoint);
            await shared.uploadFrom(blob);
            await invalidate(client, shared, shared instanceof BlobEndpoint ? "lineage" : "parent", options);
        }
    };
}
