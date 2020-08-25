import fetchMock from 'jest-fetch-mock';
import { ElementEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpStatusCode, HttpMethod, HttpHeader } from '../../http';
import { ConcurrencyError } from '../../errors';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let endpoint: ElementEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new ElementEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('read', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '{"id":5,"name":"test"}',
        {
            headers: { [HttpHeader.ContentType]: 'application/json' }
        });

    const result = await endpoint.read();
    expect(result).toEqual(new MockEntity(5, 'test'));
});

test('readCache', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '{"id":5,"name":"test"}',
        {
            headers: {
                [HttpHeader.ContentType]: 'application/json',
                [HttpHeader.ETag]: '"123abc"'
            }
        }
    );
    const result1 = await endpoint.read();
    expect(result1).toEqual(new MockEntity(5, 'test'));

    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        async req => {
            expect(req.headers.get('If-None-Match')).toBe('"123abc"');
            return { status: HttpStatusCode.NotModified };
        }
    );
    const result2 = await endpoint.read();
    expect(result2).toEqual(new MockEntity(5, 'test'));

    expect(result2).not.toBe(result1); // Should cache response, not deserialized object
});

test('existsTrue', async () => {
    fetchMock.mockOnceIf(req => req.method === HttpMethod.Head && req.url === 'http://localhost/endpoint');

    const result = await endpoint.exists();
    expect(result).toBe(true);
});

test('existsFalse', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Head && req.url === 'http://localhost/endpoint',
        async () => {
            return { status: HttpStatusCode.NotFound };
        }
    );

    const result = await endpoint.exists();
    expect(result).toBe(false);
});

test('setResult', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('{"id":5,"name":"test"}');
            return {
                headers: { [HttpHeader.ContentType]: 'application/json' },
                body: '{"id":5,"name":"testXXX"}'
            };
        }
    );

    const result = await endpoint.set(new MockEntity(5, 'test'));
    expect(result).toEqual(new MockEntity(5, 'testXXX'));
});

test('setNoResult', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('{"id":5,"name":"test"}');
            return {};
        }
    );

    const result = await endpoint.set(new MockEntity(5, 'test'));
    expect(result).toBeUndefined();
});

test('setETag', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '{"id":5,"name":"test"}',
        {
            headers: {
                [HttpHeader.ContentType]: 'application/json',
                [HttpHeader.ETag]: '"123abc"'
            }
        }
    );
    const result = await endpoint.read();

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.IfMatch)).toBe('"123abc"');
            expect(await req.text()).toBe('{"id":5,"name":"test"}');
            return {};

        }
    );
    await endpoint.set(result);
});

test('updateRetry', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Get && req.url === 'http://localhost/endpoint',
        async req => {
            return {
                headers: {
                    [HttpHeader.ContentType]: 'application/json',
                    [HttpHeader.ETag]: '"1"'
                },
                body: '{"id":5,"name":"test1"}'
            };
        }
    ).mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.IfMatch)).toBe('"1"');
            expect(await req.text()).toBe('{"id":5,"name":"testX"}');
            return { status: HttpStatusCode.PreconditionFailed };
        }
    ).mockOnceIf(
        req => req.method === HttpMethod.Get && req.url === 'http://localhost/endpoint',
        async req => {
            return {
                headers: {
                    [HttpHeader.ContentType]: 'application/json',
                    [HttpHeader.ETag]: '"2"'
                },
                body: '{"id":5,"name":"test2"}'
            };
        }
    ).mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.IfMatch)).toBe('"2"');
            expect(await req.text()).toBe('{"id":5,"name":"testX"}');
            return {
                headers: { [HttpHeader.ContentType]: 'application/json' },
                body: '{"id":5,"name":"testX"}'
            };
        }
    );

    await endpoint.update(x => x.name = 'testX');
});

test('updateFail', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Get && req.url === 'http://localhost/endpoint',
        '{"id":5,"name":"test1"}',
        {
            headers: {
                [HttpHeader.ContentType]: 'application/json',
                [HttpHeader.ETag]: '"1"'
            }
        }
    );
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.IfMatch)).toBe('"1"');
            expect(await req.text()).toBe('{"id":5,"name":"testX"}');
            return { status: HttpStatusCode.PreconditionFailed };
        }
    );

    let errorThrown = false;
    try {
        await endpoint.update(x => x.name = 'testX', 0);
    } catch (err) {
        errorThrown = err instanceof ConcurrencyError;
    }
    expect(errorThrown).toBe(true);
});

test('mergeResult', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Patch && req.url === 'http://localhost/endpoint',
        async req => {
            expect(await req.text()).toBe('{"id":5,"name":"test"}');
            return {
                headers: { [HttpHeader.ContentType]: 'application/json' },
                body: '{"id":5,"name":"testXXX"}'
            };
        }
    );

    const result = await endpoint.merge(new MockEntity(5, 'test'));
    expect(result).toEqual(new MockEntity(5, 'testXXX'));
});

test('mergeNoResult', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Patch && req.url === 'http://localhost/endpoint',
        async req => {
            expect(await req.text()).toBe('{"id":5,"name":"test"}');
            return {};
        }
    );

    const result = await endpoint.merge(new MockEntity(5, 'test'));
    expect(result).toBeUndefined();
});

test('delete', async () => {
    fetchMock.mockOnceIf(req => req.method === HttpMethod.Delete && req.url === 'http://localhost/endpoint');
    await endpoint.delete();
});

test('deleteETag', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '{"id":5,"name":"test"}',
        {
            headers: {
                [HttpHeader.ContentType]: 'application/json',
                [HttpHeader.ETag]: '"123abc"'
            }
        }
    );
    await endpoint.read();

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Delete && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.IfMatch)).toBe('"123abc"');
            return {};
        }
    );
    await endpoint.delete();
});
