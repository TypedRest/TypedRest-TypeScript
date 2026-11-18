import { QueryObserver } from '@tanstack/query-core';
import { EntryEndpoint } from 'typedrest/endpoints';
import { PollingEndpoint, SseStreamingEndpoint, StreamingCollectionEndpoint, StreamingEndpoint } from 'typedrest/endpoints/reactive';
import { HttpHeader, HttpStatusCode } from 'typedrest/http';
import { invalidateEndpoint, pollQuery, streamCollectionQuery, streamQuery, type EndpointQueryOptions } from './index';
import { createClient, MockEntity, requestHeader } from './test/helpers';

let entry: EntryEndpoint;

beforeEach(() => {
    fetchMock.resetMocks();
    entry = new EntryEndpoint('http://localhost/');
});

/**
 * Mocks a response whose body is streamed in chunks.
 * @param close Whether to close the connection after the last chunk.
 * @returns A callback reporting whether the client aborted the request.
 */
function mockStream(chunks: string[], close: boolean = true) {
    let aborted = false;
    fetchMock.mockImplementationOnce(async (_input, init) => {
        let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                streamController = controller;
                const encoder = new TextEncoder();
                for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
                if (close) controller.close();
            }
        });
        // Emulate how aborting a real request fails the response body
        init?.signal?.addEventListener('abort', () => {
            aborted = true;
            try { streamController?.error(new DOMException('Aborted', 'AbortError')); } catch { }
        }, { once: true });
        return new Response(body);
    });
    return () => aborted;
}

/**
 * Subscribes to a query like a mounted component would.
 */
function observe<TData>(client: ReturnType<typeof createClient>, options: EndpointQueryOptions<TData>) {
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => { });
    return { result: () => observer.getCurrentResult(), unsubscribe };
}

test('stream', async () => {
    mockStream(['{"id":5,"name":"test1"}\n', '{"id":6,"name":"test2"}\n']);
    const client = createClient();

    const { result, unsubscribe } = observe(client, streamQuery(new StreamingEndpoint<MockEntity>(entry, 'events')));

    await vi.waitFor(() => expect(result().fetchStatus).toBe('idle'));
    expect(result().data).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
    expect(result().status).toBe('success');
    unsubscribe();
});

test('streamStopsWhenUnused', async () => {
    const aborted = mockStream(['{"id":5,"name":"test1"}\n'], false);
    const client = createClient();

    const { result, unsubscribe } = observe(client, streamQuery(new StreamingEndpoint<MockEntity>(entry, 'events')));
    await vi.waitFor(() => expect(result().data).toEqual([new MockEntity(5, 'test1')]));
    expect(result().fetchStatus).toBe('fetching');

    unsubscribe();

    await vi.waitFor(() => expect(aborted()).toBe(true));
});

test('streamStopsWhenCancelled', async () => {
    const aborted = mockStream(['{"id":5,"name":"test1"}\n'], false);
    const client = createClient();
    const options = streamQuery(new StreamingEndpoint<MockEntity>(entry, 'events'));

    const { result, unsubscribe } = observe(client, options);
    await vi.waitFor(() => expect(result().data).toHaveLength(1));

    await client.cancelQueries({ queryKey: options.queryKey });

    await vi.waitFor(() => expect(aborted()).toBe(true));
    unsubscribe();
});

test('streamReducer', async () => {
    mockStream(['{"id":5,"name":"test1"}\n', '{"id":6,"name":"test2"}\n']);
    const client = createClient();

    const { result, unsubscribe } = observe(client, streamQuery(new StreamingEndpoint<MockEntity>(entry, 'events'), {
        reducer: (count: number, _: MockEntity) => count + 1,
        initialValue: 0
    }));

    await vi.waitFor(() => expect(result().fetchStatus).toBe('idle'));
    expect(result().data).toBe(2);
    unsubscribe();
});

test('streamSse', async () => {
    mockStream(['data: {"id":5,"name":"test1"}\n\n', 'data: {"id":6,"name":"test2"}\n\n']);
    const client = createClient();
    const endpoint = new SseStreamingEndpoint<MockEntity>(entry, 'events');

    const { result, unsubscribe } = observe(client, streamQuery(endpoint));

    await vi.waitFor(() => expect(result().data).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]));
    unsubscribe();
});

test('streamCollection', async () => {
    fetchMock.mockResponseOnce('[{"id":5,"name":"test1"}]', { status: HttpStatusCode.PartialContent, headers: { [HttpHeader.ContentRange]: 'elements 0-0/*' } });
    fetchMock.mockResponseOnce('[{"id":6,"name":"test2"}]', { status: HttpStatusCode.PartialContent, headers: { [HttpHeader.ContentRange]: 'elements 1-1/2' } });
    const client = createClient();
    const endpoint = new StreamingCollectionEndpoint<MockEntity>(entry, 'log');
    endpoint.pollingInterval = 0;

    const { result, unsubscribe } = observe(client, streamCollectionQuery(endpoint));

    await vi.waitFor(() => expect(result().fetchStatus).toBe('idle'));
    expect(result().data).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
    expect(requestHeader(1, HttpHeader.Range)).toBe('elements=1-');
    unsubscribe();
});

test('streamCollectionStopsWhenUnused', async () => {
    fetchMock.mockResponse('', { status: HttpStatusCode.RangeNotSatisfiable });
    const client = createClient();
    const endpoint = new StreamingCollectionEndpoint<MockEntity>(entry, 'log');
    endpoint.pollingInterval = 10;

    const { unsubscribe } = observe(client, streamCollectionQuery(endpoint));
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    unsubscribe();
    await new Promise(resolve => setTimeout(resolve, 30));
    const calls = fetchMock.mock.calls.length;
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(fetchMock.mock.calls.length).toBe(calls);
});

test('poll', async () => {
    fetchMock.mockResponses('{"id":1,"name":"test"}', '{"id":2,"name":"test"}', '{"id":3,"name":"test"}');
    const client = createClient();
    const endpoint = new PollingEndpoint<MockEntity>(entry, 'job', x => x.id === 3);
    endpoint.pollingInterval = 0;
    const states: (MockEntity | undefined)[] = [];

    const observer = new QueryObserver(client, pollQuery(endpoint));
    const unsubscribe = observer.subscribe(result => states.push(result.data));

    await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
    expect(observer.getCurrentResult().data).toEqual(new MockEntity(3, 'test'));
    expect(states).toContainEqual(new MockEntity(1, 'test'));
    unsubscribe();
});

test('streamsNotInvalidated', async () => {
    mockStream(['{"id":5,"name":"test1"}\n']);
    const client = createClient();
    const endpoint = new StreamingEndpoint<MockEntity>(entry, 'events');
    const { result, unsubscribe } = observe(client, streamQuery(endpoint));
    await vi.waitFor(() => expect(result().fetchStatus).toBe('idle'));

    await invalidateEndpoint(client, entry);

    expect(result().isStale).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(1);
    unsubscribe();
});
