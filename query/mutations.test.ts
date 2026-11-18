import { QueryObserver } from '@tanstack/query-core';
import { EntryEndpoint } from 'typedrest/endpoints';
import { CollectionEndpoint, ElementEndpoint } from 'typedrest/endpoints/generic';
import { ActionEndpoint, FunctionEndpoint } from 'typedrest/endpoints/rpc';
import { BlobEndpoint, UploadEndpoint } from 'typedrest/endpoints/raw';
import { HttpHeader, HttpStatusCode } from 'typedrest/http';
import { ConcurrencyError } from 'typedrest/errors';
import {
    createAllMutation, createMutation, deleteMutation, endpointFor, invokeMutation, mergeMutation, operationKey,
    readAllQuery, readQuery, setAllMutation, setMutation, updateMutation, uploadMutation, versionOf
} from './index';
import { createClient, isInvalidated, MockEntity, mutate, requestHeader, requestInit, requestUrl } from './test/helpers';

let entry: EntryEndpoint;
let contacts: CollectionEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    entry = new EntryEndpoint('http://localhost/');
    contacts = new CollectionEndpoint<MockEntity>(entry, 'contacts');
});

function mockEntity(body: string, eTag?: string) {
    fetchMock.mockResponseOnce(body, { headers: { [HttpHeader.ContentType]: 'application/json', ...(eTag ? { [HttpHeader.ETag]: eTag } : {}) } });
}

/**
 * Fills the cache with queries around contact 5, without observers, so invalidation only marks them.
 */
function seedCache(client: ReturnType<typeof createClient>) {
    const keys = {
        contacts: operationKey(contacts, 'readAll'),
        sibling: operationKey(contacts.get('6'), 'read'),
        note: operationKey(new ElementEndpoint(contacts.get('5'), './note'), 'read'),
    };
    for (const key of Object.values(keys)) client.setQueryData(key, 'data');
    return keys;
}

test('setSendsETagOfSharedEndpoint', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    fetchMock.mockResponseOnce('');
    const client = createClient();

    await client.fetchQuery(readQuery(contacts.get('5')));
    // A different endpoint object for the same URL, e.g. from another render
    await mutate(client, setMutation(contacts.get('5')), new MockEntity(5, 'changed'));

    expect(requestInit(1).method).toBe('PUT');
    expect(requestHeader(1, HttpHeader.IfMatch)).toBe('"v1"');
});

test('setSeedsAndInvalidates', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    mockEntity('{"id":5,"name":"changed"}', '"v2"');
    const client = createClient();
    const contact = contacts.get('5');
    await client.fetchQuery(readQuery(contact));
    const keys = seedCache(client);

    const result = await mutate(client, setMutation(contact), new MockEntity(5, 'changed'));

    expect(result).toEqual(new MockEntity(5, 'changed'));
    const cached = client.getQueryData(readQuery(contact).queryKey);
    expect(cached).toEqual(new MockEntity(5, 'changed'));
    expect(versionOf(cached)?.eTag).toBe('"v2"');
    expect(isInvalidated(client, keys.contacts)).toBe(true);
    expect(isInvalidated(client, keys.note)).toBe(true);
    expect(isInvalidated(client, keys.sibling)).toBe(false);
});

test('setRefetchesActiveReadBeforeResolving', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    fetchMock.mockResponseOnce('', { headers: { [HttpHeader.ETag]: '"v2"' } });
    fetchMock.mockResponseOnce(() => ({ status: HttpStatusCode.NotModified }));
    const client = createClient();
    const contact = contacts.get('5');
    const observer = new QueryObserver(client, readQuery(contact));
    const unsubscribe = observer.subscribe(() => { });
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBeDefined());

    await mutate(client, setMutation(contact), new MockEntity(5, 'changed'));

    // The active query has already refetched, so the saved version is in the cache
    expect(requestHeader(2, HttpHeader.IfNoneMatch)).toBe('"v2"');
    const cached = client.getQueryData(readQuery(contact).queryKey);
    expect(cached).toEqual(new MockEntity(5, 'changed'));
    expect(versionOf(cached)?.eTag).toBe('"v2"');
    unsubscribe();
});

test('setConcurrencyError', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.PreconditionFailed });
    const client = createClient();
    const contact = contacts.get('5');
    await client.fetchQuery(readQuery(contact));

    await expect(mutate(client, setMutation(contact), new MockEntity(5, 'changed'))).rejects.toBeInstanceOf(ConcurrencyError);
});

test('setBasedOn', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    mockEntity('{"id":5,"name":"someone else"}', '"v2"');
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.PreconditionFailed });
    const client = createClient();
    const contact = contacts.get('5');

    // The user opens the form
    const original = await client.fetchQuery(readQuery(contact));
    const basedOn = versionOf(original);
    // A background refetch picks up someone else's change
    await client.fetchQuery({ ...readQuery(contact), staleTime: 0 });

    // Saving the form sends the version the form started from
    await expect(mutate(client, setMutation(contact, { basedOn }), { ...original, name: 'mine' })).rejects.toBeInstanceOf(ConcurrencyError);
    expect(requestHeader(2, HttpHeader.IfMatch)).toBe('"v1"');
});

test('setInvalidateFalse', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const keys = seedCache(client);

    await mutate(client, setMutation(contacts.get('5'), { invalidate: false }), new MockEntity(5, 'changed'));

    expect(isInvalidated(client, keys.contacts)).toBe(false);
});

test('setAlsoInvalidate', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const keys = seedCache(client);

    await mutate(client, setMutation(contacts.get('5'), { invalidate: 'self', alsoInvalidate: [contacts.get('6')] }), new MockEntity(5, 'changed'));

    expect(isInvalidated(client, keys.contacts)).toBe(false);
    expect(isInvalidated(client, keys.sibling)).toBe(true);
});

test('mergePartial', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();

    const result = await mutate(client, mergeMutation(contacts.get('5')), { name: 'changed' });

    expect(result).toBeUndefined();
    expect(requestInit(0).method).toBe('PATCH');
    expect(requestInit(0).body).toBe('{"name":"changed"}');
});

test('update', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.PreconditionFailed });
    mockEntity('{"id":5,"name":"someone else"}', '"v2"');
    fetchMock.mockResponseOnce('');
    const client = createClient();

    await mutate(client, updateMutation(contacts.get('5')), entity => { entity.name += '!'; });

    expect(requestHeader(3, HttpHeader.IfMatch)).toBe('"v2"');
    expect(requestInit(3).body).toBe('{"id":5,"name":"someone else!"}');
});

test('deleteRemovesAndInvalidates', async () => {
    mockEntity('{"id":5,"name":"test"}', '"v1"');
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const contact = contacts.get('5');
    await client.fetchQuery(readQuery(contact));
    const keys = seedCache(client);

    await mutate(client, deleteMutation(contact), undefined);

    expect(requestInit(1).method).toBe('DELETE');
    expect(requestHeader(1, HttpHeader.IfMatch)).toBe('"v1"');
    expect(client.getQueryState(readQuery(contact).queryKey)).toBeUndefined();
    expect(client.getQueryState(keys.note)).toBeUndefined();
    expect(isInvalidated(client, keys.contacts)).toBe(true);
    expect(isInvalidated(client, keys.sibling)).toBe(false);
});

test('deleteBasedOn', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const basedOn = { content: '', eTag: '"v1"' };

    await mutate(client, deleteMutation(contacts.get('5'), { basedOn }), undefined);

    expect(requestHeader(0, HttpHeader.IfMatch)).toBe('"v1"');
});

test('createSeedsNewElement', async () => {
    fetchMock.mockResponseOnce('{"id":7,"name":"new"}', {
        status: HttpStatusCode.Created,
        headers: { [HttpHeader.ContentType]: 'application/json', [HttpHeader.Location]: 'contacts/7', [HttpHeader.ETag]: '"v1"' }
    });
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const keys = seedCache(client);

    const created = await mutate(client, createMutation(contacts), new MockEntity(0, 'new'));

    expect(created?.uri).toEqual(new URL('http://localhost/contacts/7'));
    const cached = client.getQueryData(readQuery(created!).queryKey);
    expect(cached).toEqual(new MockEntity(7, 'new'));
    expect(versionOf(cached)?.eTag).toBe('"v1"');
    expect(isInvalidated(client, keys.contacts)).toBe(true);
    expect(isInvalidated(client, keys.sibling)).toBe(false);

    // Later changes through a new endpoint object use the ETag from the creation
    await mutate(client, setMutation(contacts.get('7')), new MockEntity(7, 'changed'));
    expect(requestHeader(1, HttpHeader.IfMatch)).toBe('"v1"');
});

test('createWithoutLocation', async () => {
    fetchMock.mockResponseOnce('', { status: HttpStatusCode.Accepted });
    const client = createClient();

    expect(await mutate(client, createMutation(contacts), new MockEntity(0, 'new'))).toBeUndefined();
});

test('createAll', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const keys = seedCache(client);

    await mutate(client, createAllMutation(contacts), [new MockEntity(5, 'a'), new MockEntity(6, 'b')]);

    expect(requestInit(0).method).toBe('PATCH');
    expect(isInvalidated(client, keys.contacts)).toBe(true);
    expect(isInvalidated(client, keys.sibling)).toBe(true);
});

test('setAllBasedOn', async () => {
    mockEntity('[{"id":5,"name":"test"}]', '"v1"');
    fetchMock.mockResponseOnce('');
    const client = createClient();

    const all = await client.fetchQuery(readAllQuery(contacts));
    await mutate(client, setAllMutation(contacts, { basedOn: versionOf(all) }), []);

    expect(requestHeader(1, HttpHeader.IfMatch)).toBe('"v1"');
});

test('invokeFunction', async () => {
    mockEntity('{"id":5,"name":"result"}');
    const client = createClient();
    const keys = seedCache(client);
    const endpoint = new FunctionEndpoint<MockEntity, MockEntity>(contacts, './merge');

    const result = await mutate(client, invokeMutation(endpoint), new MockEntity(1, 'input'));

    expect(result).toEqual(new MockEntity(5, 'result'));
    expect(requestUrl(0)).toBe('http://localhost/contacts/merge');
    expect(requestInit(0).body).toBe('{"id":1,"name":"input"}');
    expect(isInvalidated(client, keys.contacts)).toBe(true);
    expect(isInvalidated(client, keys.sibling)).toBe(true);
});

test('invokeAction', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();

    await mutate(client, invokeMutation(new ActionEndpoint(contacts, './reindex')), undefined);

    expect(requestInit(0).method).toBe('POST');
    expect(requestInit(0).body).toBeUndefined();
});

test('uploadBlob', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const blob = new BlobEndpoint(contacts.get('5'), './photo');
    client.setQueryData(operationKey(blob, 'download'), 'old');

    await mutate(client, uploadMutation(blob), new Blob(['abc'], { type: 'image/png' }));

    expect(requestInit(0).method).toBe('PUT');
    expect(isInvalidated(client, operationKey(blob, 'download'))).toBe(true);
});

test('uploadForm', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();
    const keys = seedCache(client);

    await mutate(client, uploadMutation(new UploadEndpoint(contacts, './import', 'file')), new Blob(['abc']));

    expect(requestInit(0).body).toBeInstanceOf(FormData);
    expect(isInvalidated(client, keys.contacts)).toBe(true);
});

test('mutationKey', () => {
    expect(setMutation(contacts.get('5')).mutationKey).toEqual(['http://localhost', 'contacts', '5', { typedrest: 'set' }]);
});

test('mutationDoesNotRegisterEndpoint', async () => {
    fetchMock.mockResponseOnce('');
    const client = createClient();

    await mutate(client, setMutation(contacts.get('5')), new MockEntity(5, 'x'));

    const other = contacts.get('5');
    expect(endpointFor(client, other)).toBe(other);
});
