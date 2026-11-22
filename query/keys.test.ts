import { EntryEndpoint } from 'typedrest/endpoints';
import { CollectionEndpoint, ElementEndpoint } from 'typedrest/endpoints/generic';
import { ActionEndpoint } from 'typedrest/endpoints/rpc';
import { endpointKey, invalidateEndpoint, operationKey, type InvalidateScope } from './index';
import { inScope } from './keys';
import { createClient, isInvalidated, MockEntity } from './test/helpers';

const entry = new EntryEndpoint('http://localhost/api/');
const contacts = new CollectionEndpoint<MockEntity>(entry, 'contacts/');
const contact = contacts.get('5');
const note = new ElementEndpoint<{ text: string; }>(contact, './note');

test('endpointKey', () => {
    expect(endpointKey(entry)).toEqual(['http://localhost', 'api']);
    expect(endpointKey(contacts)).toEqual(['http://localhost', 'api', 'contacts']);
    expect(endpointKey(contact)).toEqual(['http://localhost', 'api', 'contacts', '5']);
    expect(endpointKey(note)).toEqual(['http://localhost', 'api', 'contacts', '5', 'note']);
});

test('endpointKeyIgnoresTrailingSlash', () => {
    expect(endpointKey(new URL('http://localhost/api/contacts'))).toEqual(endpointKey(new URL('http://localhost/api/contacts/')));
});

test('endpointKeyKeepsEncodedSegments', () => {
    expect(endpointKey(contacts.get('x/y'))).toEqual(['http://localhost', 'api', 'contacts', 'x%2Fy']);
});

test('endpointKeyQueryString', () => {
    expect(endpointKey(new URL('http://localhost/api/contacts?name=x'))).toEqual(['http://localhost', 'api', 'contacts', '?name=x']);
});

test('endpointKeyOrigin', () => {
    expect(endpointKey(new URL('https://other:8443/api'))).toEqual(['https://other:8443', 'api']);
});

test('operationKey', () => {
    expect(operationKey(contacts, 'readRange', { from: 0, to: 9 }))
        .toEqual(['http://localhost', 'api', 'contacts', { from: 0, to: 9, typedrest: 'readRange' }]);
});

describe('inScope', () => {
    const target = ['o', 'contacts', '5'];
    const cases: [InvalidateScope, string[], boolean][] = [
        ['self', ['o', 'contacts', '5'], true],
        ['self', ['o', 'contacts'], false],
        ['self', ['o', 'contacts', '5', 'note'], false],
        ['subtree', ['o', 'contacts', '5', 'note'], true],
        ['subtree', ['o', 'contacts'], false],
        ['ancestors', ['o', 'contacts'], true],
        ['ancestors', ['o'], true],
        ['ancestors', ['o', 'contacts', '5', 'note'], false],
        ['lineage', ['o', 'contacts'], true],
        ['lineage', ['o', 'contacts', '5', 'note'], true],
        ['lineage', ['o', 'contacts', '6'], false],
        ['parent', ['o', 'contacts', '6'], true],
        ['parent', ['o', 'contacts'], true],
        ['parent', ['o'], false],
        ['subtree', ['other', 'contacts', '5'], false],
    ];
    test.each(cases)('%s %j', (scope, path, expected) => {
        expect(inScope(scope, target, path)).toBe(expected);
    });
});

test('invalidateEndpoint', async () => {
    const client = createClient();
    const keys = {
        entry: operationKey(entry, 'readMeta'),
        contacts: operationKey(contacts, 'readAll'),
        contact: operationKey(contact, 'read'),
        sibling: operationKey(contacts.get('6'), 'read'),
        note: operationKey(note, 'read'),
        stream: operationKey(contacts, 'streamCollection', { startIndex: 0 }),
        foreign: ['contacts', '5'],
    };
    for (const key of Object.values(keys)) client.setQueryData(key, 'data');

    await invalidateEndpoint(client, contacts);

    expect(isInvalidated(client, keys.entry)).toBe(false);
    expect(isInvalidated(client, keys.contacts)).toBe(true);
    expect(isInvalidated(client, keys.contact)).toBe(true);
    expect(isInvalidated(client, keys.sibling)).toBe(true);
    expect(isInvalidated(client, keys.note)).toBe(true);
    expect(isInvalidated(client, keys.stream)).toBe(false);
    expect(isInvalidated(client, keys.foreign)).toBe(false);
});

test('invalidateEndpointLineage', async () => {
    const client = createClient();
    const keys = {
        entry: operationKey(entry, 'readMeta'),
        contacts: operationKey(contacts, 'readAll'),
        contact: operationKey(contact, 'read'),
        sibling: operationKey(contacts.get('6'), 'read'),
        note: operationKey(note, 'read'),
        action: operationKey(new ActionEndpoint(contacts, './notify'), 'probe'),
    };
    for (const key of Object.values(keys)) client.setQueryData(key, 'data');

    await invalidateEndpoint(client, contact, 'lineage');

    expect(isInvalidated(client, keys.entry)).toBe(true);
    expect(isInvalidated(client, keys.contacts)).toBe(true);
    expect(isInvalidated(client, keys.contact)).toBe(true);
    expect(isInvalidated(client, keys.note)).toBe(true);
    expect(isInvalidated(client, keys.sibling)).toBe(false);
    expect(isInvalidated(client, keys.action)).toBe(false);
});
