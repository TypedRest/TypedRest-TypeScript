import fetchMock from 'jest-fetch-mock';
import { PollingEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpHeader } from '../../http';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let endpoint: PollingEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new PollingEndpoint<MockEntity>(new EntryEndpoint('http://localhost/'), 'endpoint', x => x.id === 3);
    endpoint.pollingInterval = 0;
});

async function collect<T>(stream: AsyncIterable<T>) {
    const result: T[] = [];
    for await (const element of stream) result.push(element);
    return result;
}

test('stream', async () => {
    fetchMock.mockResponses(
        '{"id":1,"name":"test"}',
        '{"id":2,"name":"test"}',
        ['{"id":3,"name":"test"}', { headers: { [HttpHeader.RetryAfter]: '42' } }]
    );

    expect(await collect(endpoint.stream())).toEqual([
        new MockEntity(1, 'test'),
        new MockEntity(2, 'test'),
        new MockEntity(3, 'test')
    ]);
    expect(endpoint.pollingInterval).toBe(42000);
});

test('streamSkipsUnchanged', async () => {
    fetchMock.mockResponses(
        '{"id":1,"name":"test"}',
        '{"id":1,"name":"test"}',
        '{"id":2,"name":"test"}',
        '{"id":3,"name":"test"}'
    );

    expect(await collect(endpoint.stream())).toEqual([
        new MockEntity(1, 'test'),
        new MockEntity(2, 'test'),
        new MockEntity(3, 'test')
    ]);
});

test('streamAsyncIterator', async () => {
    fetchMock.mockResponses('{"id":3,"name":"test"}');

    expect(await collect(endpoint)).toEqual([new MockEntity(3, 'test')]);
});

test('streamAbort', async () => {
    fetchMock.mockResponse('{"id":1,"name":"test"}');
    const controller = new AbortController();

    const result: MockEntity[] = [];
    for await (const element of endpoint.stream(controller.signal)) {
        result.push(element);
        controller.abort();
    }

    expect(result).toEqual([new MockEntity(1, 'test')]);
});

test('streamBreak', async () => {
    fetchMock.mockResponse('{"id":1,"name":"test"}');

    const result: MockEntity[] = [];
    for await (const element of endpoint.stream()) {
        result.push(element);
        break;
    }

    expect(result).toEqual([new MockEntity(1, 'test')]);
});
