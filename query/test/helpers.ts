import { MutationObserver, QueryClient } from '@tanstack/query-core';
import type { EndpointMutationOptions } from '../index';

export class MockEntity {
    constructor(public id: number, public name: string) { }
}

/**
 * Creates a query client that does not retry, so errors surface immediately.
 */
export function createClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

/**
 * Runs a mutation outside of any framework, like `useMutation().mutateAsync()` would.
 */
export function mutate<TData, TVariables>(client: QueryClient, options: EndpointMutationOptions<TData, TVariables>, variables: TVariables): Promise<TData> {
    return new MutationObserver<TData, Error, TVariables>(client, options).mutate(variables);
}

/**
 * Returns the URL of the `index`th request sent to the mocked fetch().
 */
export function requestUrl(index: number) {
    return String(fetchMock.mock.calls[index][0]);
}

/**
 * Returns the init (method, headers, signal, ...) of the `index`th request sent to the mocked fetch().
 */
export function requestInit(index: number): RequestInit {
    return fetchMock.mock.calls[index][1] ?? {};
}

/**
 * Returns a header of the `index`th request sent to the mocked fetch().
 */
export function requestHeader(index: number, header: string) {
    return new Headers(requestInit(index).headers).get(header);
}

/**
 * Returns whether a query is marked as invalidated.
 */
export function isInvalidated(client: QueryClient, queryKey: readonly unknown[]) {
    return client.getQueryState(queryKey)?.isInvalidated ?? false;
}
