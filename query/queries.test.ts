import { EntryEndpoint } from 'typedrest/endpoints';
import { CollectionEndpoint, ElementEndpoint } from 'typedrest/endpoints/generic';
import { FunctionEndpoint } from 'typedrest/endpoints/rpc';
import { BlobEndpoint } from 'typedrest/endpoints/raw';
import { HttpHeader, HttpStatusCode } from 'typedrest/http';
import { NotFoundError } from 'typedrest/errors';
import {
    downloadQuery, endpointFor, existsQuery, probeQuery, readAllQuery, readMetaQuery, readQuery,
    readRangeInfiniteQuery, readRangeQuery, versionOf
} from './index';
import { createClient, MockEntity, requestHeader, requestInit, requestUrl } from './test/helpers';

let entry: EntryEndpoint;

beforeEach(() => {
    fetchMock.resetMocks();
    entry = new EntryEndpoint('http://localhost/');
});

function contactsOf(root: EntryEndpoint) {
    return new CollectionEndpoint<MockEntity>(root, 'contacts');
}

function mockEntity(body: string, eTag?: string) {
    fetchMock.mockResponseOnce(body, { headers: { [HttpHeader.ContentType]: 'application/json', ...(eTag ? { [HttpHeader.ETag]: eTag } : {}) } });
}

test('read', async () => {
    mockEntity('{"id":5,"name":"test"}');
    const client = createClient();

    const data = await client.fetchQuery(readQuery(contactsOf(entry).get('5')));

    expect(data).toEqual(new MockEntity(5, 'test'));
    expect(requestUrl(0)).toBe('http://localhost/contacts/5');
});

test('readError', async () => {
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.NotFound });

    await expect(createClient().fetchQuery(readQuery(contactsOf(entry).get('5')))).rejects.toBeInstanceOf(NotFoundError);
});

test('readPassesSignal', async () => {
    let aborted = false;
    fetchMock.mockImplementationOnce((_input, init) => new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
    }));
    const client = createClient();
    const options = readQuery(contactsOf(entry).get('5'));

    const promise = client.fetchQuery(options).catch(() => undefined);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await client.cancelQueries({ queryKey: options.queryKey });
    await promise;

    expect(aborted).toBe(true);
});

test('readSharesEndpointAcrossInstances', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    fetchMock.mockResponseOnce(() => ({ status: HttpStatusCode.NotModified }));
    const client = createClient();

    // Two separate endpoint objects for the same URL, e.g. created on two renders
    const first = contactsOf(entry).get('5');
    const second = contactsOf(entry).get('5');

    await client.fetchQuery(readQuery(first));
    const cached1 = client.getQueryData(readQuery(first).queryKey);
    await client.fetchQuery({ ...readQuery(second), staleTime: 0 });
    const cached2 = client.getQueryData(readQuery(second).queryKey);

    expect(requestHeader(1, HttpHeader.IfNoneMatch)).toBe('"v1"');
    expect(endpointFor(client, second)).toBe(first);
    expect(cached2).toBe(cached1); // 304 keeps the same object, so nothing re-renders
});

test('readSeparateHttpClients', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    const client = createClient();

    const first = contactsOf(entry).get('5');
    const other = contactsOf(new EntryEndpoint('http://localhost/')).get('5');
    await client.fetchQuery(readQuery(first));
    await client.fetchQuery({ ...readQuery(other), staleTime: 0 });

    expect(requestHeader(1, HttpHeader.IfNoneMatch)).toBeNull();
    expect(endpointFor(client, other)).toBe(other);
});

test('readEvictsEndpointWithQueries', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    const client = createClient();
    const first = contactsOf(entry).get('5');
    await client.fetchQuery(readQuery(first));

    client.removeQueries();

    const second = contactsOf(entry).get('5');
    expect(endpointFor(client, second)).toBe(second);
});

test('versionOf', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    const client = createClient();

    const data = await client.fetchQuery(readQuery(contactsOf(entry).get('5')));

    expect(versionOf(data)?.eTag).toBe('"v1"');
    expect(versionOf({})).toBeUndefined();
    expect(versionOf(undefined)).toBeUndefined();
});

test('versionOfAfterChange', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    mockEntity('{"id":5,"name":"changed"}', '"v2"');
    const client = createClient();
    const contact = contactsOf(entry).get('5');

    const data1 = await client.fetchQuery(readQuery(contact));
    const data2 = await client.fetchQuery({ ...readQuery(contact), staleTime: 0 });

    expect(data2).toEqual(new MockEntity(5, 'changed'));
    expect(versionOf(data1)?.eTag).toBe('"v1"');
    expect(versionOf(data2)?.eTag).toBe('"v2"');
});

test('versionOfAfterEqualDataWithNewETag', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    mockEntity('{"id":5,"name":"test"}', '"v2"');
    const client = createClient();
    const contact = contactsOf(entry).get('5');

    const key = readQuery(contact).queryKey;
    await client.fetchQuery(readQuery(contact));
    const cached1 = client.getQueryData(key);
    await client.fetchQuery({ ...readQuery(contact), staleTime: 0 });
    const cached2 = client.getQueryData(key);

    // Structural sharing keeps the old object in the cache, and the version moves along with it
    expect(cached2).toBe(cached1);
    expect(versionOf(cached2)?.eTag).toBe('"v2"');
});

test('exists', async () => {
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.NotFound });

    expect(await createClient().fetchQuery(existsQuery(contactsOf(entry).get('5')))).toBe(false);
    expect(requestInit(0).method).toBe('HEAD');
});

test('readAll', async () => {
    mockEntity('[{"id":5,"name":"test1"},{"id":6,"name":"test2"}]', '"v1"');

    const data = await createClient().fetchQuery(readAllQuery(contactsOf(entry)));

    expect(data).toEqual([new MockEntity(5, 'test1'), new MockEntity(6, 'test2')]);
    expect(versionOf(data)?.eTag).toBe('"v1"');
});

test('readRange', async () => {
    fetchMock.mockResponseOnce('[{"id":6,"name":"test2"}]', {
        status: HttpStatusCode.PartialContent,
        headers: { [HttpHeader.ContentRange]: 'elements 1-1/2' }
    });

    const data = await createClient().fetchQuery(readRangeQuery(contactsOf(entry), 1, 1));

    expect(data.elements).toEqual([new MockEntity(6, 'test2')]);
    expect(data.endReached).toBe(true);
    expect(requestHeader(0, HttpHeader.Range)).toBe('elements=1-1');
});

test('readRangeKeys', () => {
    const contacts = contactsOf(entry);
    expect(readRangeQuery(contacts, 0, 9).queryKey).not.toEqual(readRangeQuery(contacts, 10, 19).queryKey);
});

test('readRangeInfinite', async () => {
    fetchMock.mockResponseOnce('[{"id":5,"name":"test1"},{"id":6,"name":"test2"}]', {
        status: HttpStatusCode.PartialContent,
        headers: { [HttpHeader.ContentRange]: 'elements 0-1/3' }
    });
    fetchMock.mockResponseOnce('[{"id":7,"name":"test3"}]', {
        status: HttpStatusCode.PartialContent,
        headers: { [HttpHeader.ContentRange]: 'elements 2-2/3' }
    });
    const options = readRangeInfiniteQuery(contactsOf(entry), 2);

    const data = await createClient().fetchInfiniteQuery({ ...options, pages: 3 });

    expect(data.pages.flatMap(page => page.elements)).toEqual([
        new MockEntity(5, 'test1'), new MockEntity(6, 'test2'), new MockEntity(7, 'test3')
    ]);
    expect(data.pageParams).toEqual([0, 2]);
    expect(requestHeader(0, HttpHeader.Range)).toBe('elements=0-1');
    expect(requestHeader(1, HttpHeader.Range)).toBe('elements=2-3');
    expect(options.getNextPageParam(data.pages[1])).toBeUndefined();
});

test('readRangeInfiniteEmpty', async () => {
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.RangeNotSatisfiable });

    const data = await createClient().fetchInfiniteQuery(readRangeInfiniteQuery(contactsOf(entry), 10));

    expect(data.pages).toHaveLength(1);
    expect(data.pages[0].elements).toEqual([]);
    expect(data.pages[0].endReached).toBe(true);
});

test('probeRpc', async () => {
    fetchMock.mockResponseOnce('', { headers: { [HttpHeader.Allow]: 'POST' } });

    const data = await createClient().fetchQuery(probeQuery(new FunctionEndpoint<MockEntity, MockEntity>(entry, 'calc')));

    expect(data).toEqual({ invokeAllowed: true });
    expect(requestInit(0).method).toBe('OPTIONS');
});

test('probeBlob', async () => {
    fetchMock.mockResponseOnce('', { headers: { [HttpHeader.Allow]: 'GET, DELETE' } });

    const data = await createClient().fetchQuery(probeQuery(new BlobEndpoint(entry, 'blob')));

    expect(data).toEqual({ downloadAllowed: true, uploadAllowed: false, deleteAllowed: true });
});

test('readMeta', async () => {
    fetchMock.mockResponseOnce('', { headers: { [HttpHeader.Link]: '<a>; rel=child' } });
    const client = createClient();

    expect(await client.fetchQuery(readMetaQuery(entry))).toBeNull();
    expect(endpointFor(client, entry).link('child')).toEqual(new URL('http://localhost/a'));
});

test('download', async () => {
    fetchMock.mockResponseOnce('abc', { headers: { [HttpHeader.ContentType]: 'text/plain' } });

    const data = await createClient().fetchQuery(downloadQuery(new BlobEndpoint(entry, 'blob')));

    expect(await data.text()).toBe('abc');
});

test('readOnSubclass', async () => {
    class ContactEndpoint extends ElementEndpoint<MockEntity> { }
    mockEntity('{"id":5,"name":"test"}');

    const data = await createClient().fetchQuery(readQuery(new ContactEndpoint(entry, 'contact')));

    expect(data.name).toBe('test');
});
