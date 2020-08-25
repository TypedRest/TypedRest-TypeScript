import fetchMock from 'jest-fetch-mock';
import { CollectionEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpHeader, HttpStatusCode, HttpMethod } from '../../http';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let endpoint: CollectionEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new CollectionEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('getById', () => {
    expect(endpoint.get('x/y').uri.href).toBe('http://localhost/endpoint/x%2Fy');
});

test('getByIdWithLinkHeaderRelative', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[]',
        {
            headers: {
                [HttpHeader.Link]: '<children{?id}>; rel=child; templated=true'
            }
        }
    );
    await endpoint.readAll();

    expect(endpoint.get('1').uri.href).toBe('http://localhost/children?id=1');
});

test('getByIdWithLinkHeaderAbsolute', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[]',
        {
            headers: {
                [HttpHeader.Link]: '<http://localhost/children{?id}>; rel=child; templated=true'
            }
        }
    );
    await endpoint.readAll();

    expect(endpoint.get('1').uri.href).toBe('http://localhost/children?id=1');
});

test('getByEntity', () => {
    expect(endpoint.get(new MockEntity(1, 'test')).uri.href).toBe('http://localhost/endpoint/1');
});

test('getByEntityWithLinkHeaderRelative', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[]',
        {
            headers: {
                [HttpHeader.Link]: '<children/{id}>; rel=child; templated=true'
            }
        }
    );
    await endpoint.readAll();

    expect(endpoint.get('1').uri.href).toBe('http://localhost/children/1');
});

test('getByEntityWithLinkHeaderAbsolute', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[]',
        {
            headers: {
                [HttpHeader.Link]: '<http://localhost/children/{id}>; rel=child; templated=true'
            }
        }
    );
    await endpoint.readAll();

    expect(endpoint.get('1').uri.href).toBe('http://localhost/children/1');
});

test('readAll', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[{"id":5,"name":"test1"}, {"id":6,"name":"test2"}]'
    );

    const result = await endpoint.readAll();
    expect(result).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('readAllCache', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[{"id":5,"name":"test1"}, {"id":6,"name":"test2"}]',
        {
            headers: {
                [HttpHeader.ETag]: '"123abc"'
            }
        }
    );
    const result1 = await endpoint.readAll();
    expect(result1).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);

    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.IfNoneMatch)).toBe('"123abc"');
            return { status: HttpStatusCode.NotModified };
        }
    );
    const result2 = await endpoint.readAll();
    expect(result2).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);

    expect(result2).not.toBe(result1); // Should cache response, not deserialized object
});

test('create', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('{"id":0,"name":"test"}');
            return { body: '{"id":5,"name":"test"}' };
        }
    );

    const element = await endpoint.create(new MockEntity(0, 'test'));
    expect(element.response).toEqual(new MockEntity(5, 'test'));
    expect(element.uri.href).toBe('http://localhost/endpoint/5');
});

test('createLocation', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('{"id":0,"name":"test"}');
            return {
                body: '{"id":5,"name":"test"}',
                headers: {
                    [HttpHeader.Location]: '/endpoint/new'
                }
            };
        }
    );

    const element = await endpoint.create(new MockEntity(0, 'test'));
    expect(element.response).toEqual(new MockEntity(5, 'test'));
    expect(element.uri.href).toBe('http://localhost/endpoint/new');
});

test('createAll', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Patch && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('[{"id":5,"name":"test1"},{"id":6,"name":"test2"}]');
            return {};
        }
    );

    await endpoint.createAll([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('setAll', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('[{"id":5,"name":"test1"},{"id":6,"name":"test2"}]');
            return {};
        }
    );

    await endpoint.setAll([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
});

test('setAllETag', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[{"id":5,"name":"test1"}, {"id":6,"name":"test2"}]',
        {
            headers: { [HttpHeader.ETag]: '"123abc"' }
        });
    const result = await endpoint.readAll();

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.IfMatch)).toBe('"123abc"');
            expect(await req.text()).toBe('[{"id":5,"name":"test1"},{"id":6,"name":"test2"}]');
            return {};
        }
    );
    await endpoint.setAll(result);
});
