/**
 * NOTE: The jsdom environment does not expose response bodies as streams, so these tests need the node environment.
 * @jest-environment node
 */

import fetchMock from 'jest-fetch-mock';
import { StreamingEndpoint } from '.';
import { EntryEndpoint } from '..';
import { NotFoundError } from '../../errors';
import { HttpStatusCode } from '../../http';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let entryEndpoint: EntryEndpoint;

beforeEach(() => {
    fetchMock.resetMocks();
    entryEndpoint = new EntryEndpoint('http://localhost/');
});

/**
 * Mocks a response whose body is streamed in multiple chunks.
 * @param chunks The chunks to send, in order.
 * @param close Whether to close the connection after the last chunk.
 * @returns A callback reporting whether the client has cancelled the connection.
 */
function mockStream(chunks: string[], close: boolean = true) {
    let cancelled = false;

    fetchMock.mockImplementation(async (_input, init) => {
        let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                streamController = controller;
                const encoder = new TextEncoder();
                for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
                if (close) controller.close();
            },
            cancel() { cancelled = true; }
        });

        // Emulate how aborting a real request fails the response body
        init?.signal?.addEventListener('abort', () => {
            try { streamController?.error(new Error('aborted')); } catch { }
        }, { once: true });

        return new Response(body);
    });

    return () => cancelled;
}

async function collect<T>(stream: AsyncIterable<T>) {
    const result: T[] = [];
    for await (const element of stream) result.push(element);
    return result;
}

test('stream', async () => {
    mockStream(['{"id":5,"name":"test1"}\n', '{"id":6,"name":"test2"}\n']);
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('streamSplitAcrossChunks', async () => {
    mockStream(['{"id":5,"na', 'me":"test1"}\n{"id":6,', '"name":"test2"}\n']);
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('streamWithoutTrailingSeparator', async () => {
    mockStream(['{"id":5,"name":"test1"}\n{"id":6,"name":"test2"}']);
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('streamCustomSeparator', async () => {
    mockStream(['{"id":5,"name":"test1"}|{"id":6,"name":"test2"}']);
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint', '|');

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('streamAsyncIterator', async () => {
    mockStream(['{"id":5,"name":"test1"}\n']);
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');

    expect(await collect(endpoint)).toEqual([new MockEntity(5, 'test1')]);
});

test('streamBreak', async () => {
    const cancelled = mockStream(['{"id":5,"name":"test1"}\n', '{"id":6,"name":"test2"}\n'], false);
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');

    const result: MockEntity[] = [];
    for await (const element of endpoint.stream()) {
        result.push(element);
        break;
    }

    expect(result).toEqual([new MockEntity(5, 'test1')]);
    expect(cancelled()).toBe(true);
});

test('streamAbort', async () => {
    mockStream(['{"id":5,"name":"test1"}\n', '{"id":6,"name":"test2"}\n'], false);
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');
    const controller = new AbortController();

    const result: MockEntity[] = [];
    for await (const element of endpoint.stream(controller.signal)) {
        result.push(element);
        if (result.length === 2) controller.abort();
    }

    expect(result).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('streamError', async () => {
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.NotFound });
    const endpoint = new StreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');

    await expect(collect(endpoint.stream())).rejects.toThrow(NotFoundError);
});
