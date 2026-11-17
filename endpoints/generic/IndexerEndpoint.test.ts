import { IndexerEndpoint, ElementEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpMethod, HttpStatusCode } from '../../http';
import { StreamingEndpoint } from '../reactive';

let endpoint: IndexerEndpoint<ElementEndpoint<{}>>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new IndexerEndpoint<ElementEndpoint<{}>>(new EntryEndpoint('http://localhost/'), 'endpoint', ElementEndpoint);
});

test('getById', () => {
    expect(endpoint.get('x/y').uri).toEqual(new URL('http://localhost/endpoint/x%2Fy'));
});

test('containsTrue', async () => {
    fetchMock.mockOnceIf(req => req.method === HttpMethod.Head && req.url === 'http://localhost/endpoint/5', '');

    expect(await endpoint.contains('5')).toBe(true);
});

test('containsFalse', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Head && req.url === 'http://localhost/endpoint/5',
        { status: HttpStatusCode.NotFound });

    expect(await endpoint.contains('5')).toBe(false);
});

test('containsAbort', async () => {
    fetchMock.mockOnceIf(req => req.method === HttpMethod.Head && req.url === 'http://localhost/endpoint/5', '');
    const controller = new AbortController();
    controller.abort();

    await expect(endpoint.contains('5', controller.signal)).rejects.toThrow(/abort/i);
});

test('delete', async () => {
    fetchMock.mockOnceIf(req => req.method === HttpMethod.Delete && req.url === 'http://localhost/endpoint/5', '');

    await endpoint.delete('5');
    expect(fetchMock.requests()).toHaveLength(1);
});

test('deleteAbort', async () => {
    fetchMock.mockOnceIf(req => req.method === HttpMethod.Delete && req.url === 'http://localhost/endpoint/5', '');
    const controller = new AbortController();
    controller.abort();

    await expect(endpoint.delete('5', controller.signal)).rejects.toThrow(/abort/i);
});

test('shortcutsRequireElementEndpoint', () => {
    const streams = new IndexerEndpoint<StreamingEndpoint<{}>>(new EntryEndpoint('http://localhost/'), 'endpoint', StreamingEndpoint);
    const check = () => {
        // @ts-expect-error contains() is only available for element endpoints
        streams.contains('5');
        // @ts-expect-error delete() is only available for element endpoints
        streams.delete('5');
    };
    expect(check).toBeDefined();
});
