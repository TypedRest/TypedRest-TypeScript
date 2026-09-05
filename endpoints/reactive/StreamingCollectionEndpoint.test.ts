/**
 * NOTE: The jsdom environment strips the "Range" request header, so these tests need the node environment.
 * @jest-environment node
 */

import fetchMock from 'jest-fetch-mock';
import { StreamingCollectionEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpHeader, HttpStatusCode } from '../../http';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let endpoint: StreamingCollectionEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new StreamingCollectionEndpoint<MockEntity>(new EntryEndpoint('http://localhost/'), 'endpoint');
    endpoint.pollingInterval = 0;
});

function mockRangeOnce(body: string, contentRange?: string, retryAfterHeader?: string) {
    const headers: { [key: string]: string; } = {};
    if (contentRange) headers[HttpHeader.ContentRange] = contentRange;
    if (retryAfterHeader) headers[HttpHeader.RetryAfter] = retryAfterHeader;

    fetchMock.mockResponseOnce(body, { status: HttpStatusCode.PartialContent, headers });
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
    mockRangeOnce('[{"id":5,"name":"test1"},{"id":6,"name":"test2"}]', 'elements 0-1/*');
    mockRangeOnce('[{"id":7,"name":"test3"}]', 'elements 2-2/3', '42');

    expect(await collect(endpoint.stream())).toEqual([
        new MockEntity(5, 'test1'),
        new MockEntity(6, 'test2'),
        new MockEntity(7, 'test3')
    ]);
    expect(requestHeader(0, HttpHeader.Range)).toBe('elements=0-');
    expect(requestHeader(1, HttpHeader.Range)).toBe('elements=2-');
    expect(endpoint.pollingInterval).toBe(42000);
});

test('streamOffset', async () => {
    mockRangeOnce('[{"id":7,"name":"test3"}]', 'elements 2-2/3');

    expect(await collect(endpoint.stream(2))).toEqual([new MockEntity(7, 'test3')]);
    expect(requestHeader(0, HttpHeader.Range)).toBe('elements=2-');
});

test('streamTail', async () => {
    mockRangeOnce('[{"id":7,"name":"test3"}]', 'elements 2-2/3');

    expect(await collect(endpoint.stream(-1))).toEqual([new MockEntity(7, 'test3')]);
    expect(requestHeader(0, HttpHeader.Range)).toBe('elements=-1');
});

test('streamAsyncIterator', async () => {
    mockRangeOnce('[{"id":5,"name":"test1"}]', 'elements 0-0/1');

    expect(await collect(endpoint)).toEqual([new MockEntity(5, 'test1')]);
});

test('streamKeepsPollingWhileRangeNotSatisfiable', async () => {
    mockRangeOnce('[{"id":5,"name":"test1"}]', 'elements 0-0/*');
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.RangeNotSatisfiable });
    mockRangeOnce('[{"id":6,"name":"test2"}]', 'elements 1-1/2');

    expect(await collect(endpoint.stream())).toEqual([
        new MockEntity(5, 'test1'),
        new MockEntity(6, 'test2')
    ]);
    expect(requestHeader(1, HttpHeader.Range)).toBe('elements=1-');
    expect(requestHeader(2, HttpHeader.Range)).toBe('elements=1-');
});

test('streamEndsWithoutContentRange', async () => {
    fetchMock.mockResponseOnce('[{"id":5,"name":"test1"}]');

    expect(await collect(endpoint.stream())).toEqual([new MockEntity(5, 'test1')]);
    expect(fetchMock.mock.calls.length).toBe(1);
});

test('streamAbort', async () => {
    fetchMock.mockResponse('[{"id":5,"name":"test1"}]', {
        status: HttpStatusCode.PartialContent,
        headers: { [HttpHeader.ContentRange]: 'elements 0-0/*' }
    });
    const controller = new AbortController();

    const result: MockEntity[] = [];
    for await (const element of endpoint.stream(0, controller.signal)) {
        result.push(element);
        controller.abort();
    }

    expect(result).toEqual([new MockEntity(5, 'test1')]);
});
