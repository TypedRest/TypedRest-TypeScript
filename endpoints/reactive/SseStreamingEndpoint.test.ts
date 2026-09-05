/**
 * NOTE: The jsdom environment does not expose response bodies as streams, so these tests need the node environment.
 * @jest-environment node
 */

import fetchMock from 'jest-fetch-mock';
import { SseStreamingEndpoint } from '.';
import { EntryEndpoint } from '..';
import { ConflictError } from '../../errors';
import { HttpHeader, HttpStatusCode } from '../../http';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let entryEndpoint: EntryEndpoint;
let endpoint: SseStreamingEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    entryEndpoint = new EntryEndpoint('http://localhost/');
    endpoint = new SseStreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint');
    endpoint.autoReconnect = false;
});

function sseEvent(data: string, type?: string, id?: string) {
    return (type ? `event: ${type}\n` : '')
        + (id ? `id: ${id}\n` : '')
        + `data: ${data}\n\n`;
}

/**
 * Mocks a response that ends the stream for good.<br>
 * NOTE: Needs a `null` body because a 204 response must not have one.
 */
function mockNoContentOnce() {
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: HttpStatusCode.NoContent }));
}

function requestHeader(index: number, header: HttpHeader) {
    return new Headers(fetchMock.mock.calls[index][1]?.headers).get(header);
}

async function collect<T>(stream: AsyncIterable<T>) {
    const result: T[] = [];
    for await (const element of stream) result.push(element);
    return result;
}

test('stream', async () => {
    fetchMock.mockResponseOnce(
        sseEvent('{"id":5,"name":"test1"}')
        + sseEvent('{"id":6,"name":"test2"}')
        + sseEvent('{"id":7,"name":"test3"}'));

    expect(await collect(endpoint.stream())).toEqual([
        new MockEntity(5, 'test1'),
        new MockEntity(6, 'test2'),
        new MockEntity(7, 'test3')
    ]);
    expect(requestHeader(0, HttpHeader.Accept)).toBe('text/event-stream');
});

test('streamAsyncIterator', async () => {
    fetchMock.mockResponseOnce(sseEvent('{"id":5,"name":"test1"}'));

    expect(await collect(endpoint)).toEqual([new MockEntity(5, 'test1')]);
});

test('streamEventTypeFilter', async () => {
    endpoint = new SseStreamingEndpoint<MockEntity>(entryEndpoint, 'endpoint', 'update');
    endpoint.autoReconnect = false;

    fetchMock.mockResponseOnce(
        sseEvent('{"id":1,"name":"skip"}', 'ignored')
        + sseEvent('{"id":5,"name":"test1"}', 'update')
        + sseEvent('{"id":99,"name":"default"}')
        + sseEvent('{"id":6,"name":"test2"}', 'update'));

    expect(await collect(endpoint.stream())).toEqual([
        new MockEntity(5, 'test1'),
        new MockEntity(6, 'test2')
    ]);
});

test('streamComments', async () => {
    fetchMock.mockResponseOnce(': keep-alive\n\n' + sseEvent('{"id":5,"name":"test1"}'));

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1')]);
});

test('streamMultiLineData', async () => {
    fetchMock.mockResponseOnce('data: {"id":5,\ndata: "name":"test1"}\n\n');

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1')]);
});

test('streamCarriageReturns', async () => {
    fetchMock.mockResponseOnce('data: {"id":5,"name":"test1"}\r\n\r\ndata: {"id":6,"name":"test2"}\r\r');

    expect(await collect(endpoint.stream())).toEqual([
        new MockEntity(5, 'test1'),
        new MockEntity(6, 'test2')
    ]);
});

test('streamError', async () => {
    fetchMock.mockResponseOnce('{"message":"my message"}', {
        status: HttpStatusCode.Conflict,
        headers: { [HttpHeader.ContentType]: 'application/json' }
    });

    await expect(collect(endpoint.stream())).rejects.toThrow(new ConflictError('my message', HttpStatusCode.Conflict));
});

test('streamNoContentCompletes', async () => {
    endpoint.autoReconnect = true;
    mockNoContentOnce();

    expect(await collect(endpoint.stream())).toEqual([]);
});

test('streamReconnectsWithLastEventId', async () => {
    endpoint.autoReconnect = true;
    endpoint.defaultReconnectionInterval = 0;
    fetchMock.mockResponseOnce(sseEvent('{"id":5,"name":"test1"}', undefined, '42'));
    mockNoContentOnce();

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1')]);
    expect(requestHeader(0, HttpHeader.LastEventId)).toBeNull();
    expect(requestHeader(1, HttpHeader.LastEventId)).toBe('42');
});

test('streamReconnectsOnServerError', async () => {
    endpoint.autoReconnect = true;
    endpoint.defaultReconnectionInterval = 0;
    fetchMock.mockResponseOnce('', { status: 503 });
    fetchMock.mockResponseOnce(sseEvent('{"id":5,"name":"test1"}'));
    mockNoContentOnce();

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1')]);
});

test('streamHonorsRetryField', async () => {
    endpoint.autoReconnect = true;
    endpoint.defaultReconnectionInterval = 0;
    fetchMock.mockResponseOnce('retry: 42\n\n' + sseEvent('{"id":5,"name":"test1"}'));
    mockNoContentOnce();

    const start = Date.now();
    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1')]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(42);
});

test('streamAbort', async () => {
    endpoint.autoReconnect = true;
    endpoint.defaultReconnectionInterval = 0;
    fetchMock.mockResponse(sseEvent('{"id":5,"name":"test1"}'));
    const controller = new AbortController();

    const result: MockEntity[] = [];
    for await (const element of endpoint.stream(controller.signal)) {
        result.push(element);
        controller.abort();
    }

    expect(result).toEqual([new MockEntity(5, 'test1')]);
});
