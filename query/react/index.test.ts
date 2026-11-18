// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { render, renderHook, screen } from '@testing-library/react';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { EntryEndpoint } from 'typedrest/endpoints';
import { CollectionEndpoint } from 'typedrest/endpoints/generic';
import { HttpHeader } from 'typedrest/http';
import { readQuery, setMutation, versionOf } from '../index';
import { createClientContext } from './index';
import { createClient, MockEntity, requestHeader } from '../test/helpers';

class MyClient extends EntryEndpoint {
    readonly contacts = new CollectionEndpoint<MockEntity>(this, 'contacts');
}

const { ClientProvider, useClient } = createClientContext<MyClient>();

beforeEach(() => {
    fetchMock.resetMocks();
});

test('useClient', () => {
    const client = new MyClient('http://localhost/');
    const wrapper = ({ children }: { children?: ReactNode; }) => createElement(ClientProvider, { client }, children);

    const { result } = renderHook(() => useClient(), { wrapper });

    expect(result.current).toBe(client);
});

test('useClientWithoutProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => { });

    expect(() => renderHook(() => useClient())).toThrow(/ClientProvider/);
});

test('editForm', async () => {
    fetchMock.mockResponseOnce('{"id":5,"name":"test"}', { headers: { [HttpHeader.ContentType]: 'application/json', [HttpHeader.ETag]: '"v1"' } });
    fetchMock.mockResponseOnce('');
    const queryClient = createClient();
    let save: ((entity: MockEntity) => Promise<unknown>) | undefined;

    function Contact({ id }: { id: string; }) {
        // A new endpoint object on every render; the package shares one instance per URL
        const contact = useClient().contacts.get(id);
        const query = useQuery(readQuery(contact));
        const mutation = useMutation(setMutation(contact, { basedOn: versionOf(query.data) }));
        save = mutation.mutateAsync;
        return createElement('span', null, query.data?.name ?? 'loading');
    }

    render(createElement(QueryClientProvider, { client: queryClient },
        createElement(ClientProvider, { client: new MyClient('http://localhost/') },
            createElement(Contact, { id: '5' }))));

    expect(await screen.findByText('test')).toBeTruthy();
    await save!(new MockEntity(5, 'changed'));
    expect(requestHeader(1, HttpHeader.IfMatch)).toBe('"v1"');
});
