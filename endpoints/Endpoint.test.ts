import fetchMock from 'jest-fetch-mock';
import { Endpoint, EntryEndpoint } from '.';
import { HttpMethod, HttpHeader, HttpStatusCode } from '../http';
import { ActionEndpoint } from './rpc';
import { ConflictError } from '../errors';

class CustomEndpoint extends Endpoint {
    async get() { await this.send(HttpMethod.Get); }

    isMethodAllowedPublic(method: HttpMethod) { return this.isMethodAllowed(method); }
}

fetchMock.enableMocks();
let endpoint: CustomEndpoint;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new CustomEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('acceptHeader', async () => {
    fetchMock.mockOnceIf(
        req => req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.Accept)).toBe('application/json');
            return {};
        }
    );

    await endpoint.get();
});

test('allowHeader', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Allow]: HttpMethod.Put + ", " + HttpMethod.Post
            }
        });
    await endpoint.get();

    expect(endpoint.isMethodAllowedPublic(HttpMethod.Put)).toBe(true);
    expect(endpoint.isMethodAllowedPublic(HttpMethod.Post)).toBe(true);
    expect(endpoint.isMethodAllowedPublic(HttpMethod.Delete)).toBe(false);
});

test('link', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<a>; rel=target1, <b>; rel=target2'
            }
        });
    await endpoint.get();

    expect(endpoint.link('target1')).toEqual(new URL('http://localhost/a'));
    expect(endpoint.link('target2')).toEqual(new URL('http://localhost/b'));
});

test('linkAbsolute', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<http://localhost/b>; rel=target1'
            }
        });
    await endpoint.get();

    expect(endpoint.link('target1')).toEqual(new URL('http://localhost/b'));
});

test('linkError', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<http://localhost/a>; rel=target1'
            }
        });
    await endpoint.get();

    expect(() => endpoint.link('target2')).toThrow();
});

test('getLinks', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<target1>; rel=child; title=Title, <target2>; rel=child'
            }
        });
    await endpoint.get();

    expect(endpoint.getLinks('child')).toEqual([
        { uri: new URL('http://localhost/target1'), title: 'Title' },
        { uri: new URL('http://localhost/target2') }
    ]);
});

test('getLinksEscaping', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<target1>; rel=child; title="Title,= 1", <target2>; rel=child'
            }
        });
    await endpoint.get();

    expect(endpoint.getLinks('child')).toEqual([
        { uri: new URL('http://localhost/target1'), title: 'Title,= 1' },
        { uri: new URL('http://localhost/target2') }
    ]);
});

test('setDefaultLink', () => {
    endpoint.setDefaultLink('child', 'target');
    expect(endpoint.link('child')).toEqual(new URL('http://localhost/target'));
});

test('linkTemplate', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<a{?x}>; rel=child; templated=true'
            }
        });
    await endpoint.get();

    expect(endpoint.getLinkTemplate('child')).toBe('a{?x}');
});

test('linkTemplateResolve', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<a{?x}>; rel=child; templated=true'
            }
        });
    await endpoint.get();

    expect(endpoint.linkTemplate('child', { x: '1' }))
        .toEqual(new URL('http://localhost/a?x=1'));
});

test('linkTemplateResolveAbsolute', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<http://localhost/b{?x}>; rel=child; templated=true'
            }
        });
    await endpoint.get();

    expect(endpoint.linkTemplate('child', { x: '1' }))
        .toEqual(new URL('http://localhost/b?x=1'));
});

test('linkTemplateResolveQuery', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<http://localhost/b{?x,y}>; rel=search; templated=true'
            }
        });
    await endpoint.get();

    expect(endpoint.linkTemplate('search', { x: '1', y: '2' }))
        .toEqual(new URL('http://localhost/b?x=1&y=2'));
});

test('linkTemplateError', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            headers: {
                [HttpHeader.Link]: '<a>; rel=child; templated=true'
            }
        });
    await endpoint.get();

    expect(() => endpoint.getLinkTemplate('child2')).toThrow();
});

test('linkHal', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        JSON.stringify({
            _links: {
                single: { href: 'a' },
                collection: [{ href: 'b', title: 'Title 1' }, { href: 'c' }],
                template: [{ href: '{id}', templated: true }]
            }
        }),
        {
            headers: {
                [HttpHeader.ContentType]: 'application/hal+json'
            }
        });
    await endpoint.get();

    expect(endpoint.link('single')).toEqual(new URL('http://localhost/a'));
    expect(endpoint.getLinks('collection')).toEqual([
        { uri: new URL('http://localhost/b'), title: 'Title 1' },
        { uri: new URL('http://localhost/c') }
    ]);
    expect(endpoint.getLinkTemplate('template')).toEqual('{id}');
});

test('setDefaultLinkTemplate', () => {
    endpoint.setDefaultLinkTemplate('child', 'a');
    expect(endpoint.getLinkTemplate('child')).toBe('a');
});

test('ensureTrailingSlashOnReferrerUri', () => {
    expect(new ActionEndpoint(endpoint, 'subresource').uri).toEqual(new URL('http://localhost/subresource'));
    expect(new ActionEndpoint(endpoint, './subresource').uri).toEqual(new URL('http://localhost/endpoint/subresource'));
});

test('errorHandlingWithNoContent', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{}',
        {
            status: HttpStatusCode.Conflict
        });

    let errorThrown = false;
    try {
        await endpoint.get();
    } catch (err) {
        errorThrown = err instanceof ConflictError;
    }
    expect(errorThrown).toBe(true);
});

test('errorHandlingWithMessage', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '{"message":"my message"}',
        {
            status: HttpStatusCode.Conflict,
            headers: {
                [HttpHeader.ContentType]: 'application/json'
            }
        });

    let errorThrown = false;
    try {
        await endpoint.get();
    } catch (err) {
        errorThrown = err instanceof ConflictError && err.message === 'my message';
    }
    expect(errorThrown).toBe(true);
});

test('errorHandlingWithArray', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '[{"message":"my message"}]',
        {
            status: HttpStatusCode.Conflict,
            headers: {
                [HttpHeader.ContentType]: 'application/json'
            }
        });

    let errorThrown = false;
    try {
        await endpoint.get();
    } catch (err) {
        errorThrown = err instanceof ConflictError;
    }
    expect(errorThrown).toBe(true);
});

test('errorHandlingWithUnknownContentType', async () => {
    fetchMock.mockOnceIf('http://localhost/endpoint',
        '...',
        {
            status: HttpStatusCode.Conflict,
            headers: {
                [HttpHeader.ContentType]: 'dummy/type'
            }
        });

    let errorThrown = false;
    try {
        await endpoint.get();
    } catch (err) {
        errorThrown = err instanceof ConflictError;
    }
    expect(errorThrown).toBe(true);
});
