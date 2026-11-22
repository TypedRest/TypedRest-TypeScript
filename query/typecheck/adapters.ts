// Compile-time checks that the options work with TanStack's framework adapters and that entity types flow through.
// This file is type-checked by `npm run typecheck` but never executed.
import { expectTypeOf } from 'vitest';
import * as react from '@tanstack/react-query';
import * as solid from '@tanstack/solid-query';
import { QueryClient } from '@tanstack/query-core';
import { EntryEndpoint } from 'typedrest/endpoints';
import { CollectionEndpoint, ElementEndpoint, type PartialResponse } from 'typedrest/endpoints/generic';
import { ActionEndpoint, ConsumerEndpoint, FunctionEndpoint, ProducerEndpoint } from 'typedrest/endpoints/rpc';
import { PollingEndpoint, StreamingCollectionEndpoint, StreamingEndpoint } from 'typedrest/endpoints/reactive';
import {
    createMutation, deleteMutation, invokeMutation, mergeMutation, pollQuery, readAllQuery, readQuery, readRangeInfiniteQuery,
    readRangeQuery, setMutation, streamCollectionQuery, streamQuery, updateMutation, versionOf
} from '../index';

interface Contact { id: string; name: string; }

class ContactEndpoint extends ElementEndpoint<Contact> {
    readonly note = new ElementEndpoint<{ text: string; }>(this, './note');
}

class MyClient extends EntryEndpoint {
    readonly contacts = new CollectionEndpoint<Contact>(this, 'contacts');
    readonly customContacts = new (class extends CollectionEndpoint<Contact> { })(this, 'custom');
    readonly events = new StreamingEndpoint<Contact>(this, 'events');
    readonly log = new StreamingCollectionEndpoint<Contact>(this, 'log');
    readonly job = new PollingEndpoint<{ done: boolean; }>(this, 'job');
    readonly reindex = new ActionEndpoint(this, 'reindex');
    readonly importOne = new ConsumerEndpoint<Contact>(this, 'import');
    readonly lookup = new FunctionEndpoint<Contact, Contact[]>(this, 'lookup');
    readonly next = new ProducerEndpoint<Contact>(this, 'next');
}

declare const client: MyClient;
const contact = new ContactEndpoint(client.contacts, '5');

export function reactQueries() {
    expectTypeOf(react.useQuery(readQuery(contact)).data).toEqualTypeOf<Contact | undefined>();
    expectTypeOf(react.useQuery(readQuery(contact.note)).data).toEqualTypeOf<{ text: string; } | undefined>();
    expectTypeOf(react.useQuery(readAllQuery(client.contacts)).data).toEqualTypeOf<Contact[] | undefined>();
    expectTypeOf(react.useQuery(readAllQuery(client.customContacts)).data).toEqualTypeOf<Contact[] | undefined>();
    expectTypeOf(react.useQuery(readRangeQuery(client.contacts, 0, 9)).data).toEqualTypeOf<PartialResponse<Contact> | undefined>();
    // NOTE: The adapters type pageParams as unknown[] unless you pass TPageParam explicitly
    expectTypeOf(react.useInfiniteQuery(readRangeInfiniteQuery(client.contacts, 20)).data?.pages).toEqualTypeOf<PartialResponse<Contact>[] | undefined>();
    expectTypeOf(react.useQuery(streamQuery(client.events)).data).toEqualTypeOf<Contact[] | undefined>();
    expectTypeOf(react.useQuery(streamQuery(client.events, { reducer: (n: number, _: Contact) => n + 1, initialValue: 0 })).data).toEqualTypeOf<number | undefined>();
    expectTypeOf(react.useQuery(streamCollectionQuery(client.log)).data).toEqualTypeOf<Contact[] | undefined>();
    expectTypeOf(react.useQuery(pollQuery(client.job)).data).toEqualTypeOf<{ done: boolean; } | undefined>();

    // Spreading to override options, including select
    expectTypeOf(react.useQuery({ ...readQuery(contact), select: (c: Contact) => c.name }).data).toEqualTypeOf<string | undefined>();
    expectTypeOf(react.useSuspenseQuery(readQuery(contact)).data).toEqualTypeOf<Contact>();
}

export function reactMutations() {
    const set = react.useMutation(setMutation(contact, { basedOn: versionOf(undefined) }));
    expectTypeOf(set.mutate).parameter(0).toEqualTypeOf<Contact>();
    expectTypeOf(set.data).toEqualTypeOf<Contact | undefined>();

    expectTypeOf(react.useMutation(mergeMutation(contact)).mutate).parameter(0).toEqualTypeOf<Partial<Contact>>();
    expectTypeOf(react.useMutation(updateMutation(contact)).mutate).parameter(0).toEqualTypeOf<(entity: Contact) => void>();
    react.useMutation(deleteMutation(contact)).mutate();
    expectTypeOf(react.useMutation(createMutation(client.contacts)).data).toEqualTypeOf<ElementEndpoint<Contact> | undefined>();

    react.useMutation(invokeMutation(client.reindex)).mutate();
    // @ts-expect-error An action takes no input
    react.useMutation(invokeMutation(client.reindex)).mutate({ id: '1', name: 'x' });
    expectTypeOf(react.useMutation(invokeMutation(client.importOne)).mutate).parameter(0).toEqualTypeOf<Contact>();
    expectTypeOf(react.useMutation(invokeMutation(client.lookup)).data).toEqualTypeOf<Contact[] | undefined>();
    expectTypeOf(react.useMutation(invokeMutation(client.lookup)).mutate).parameter(0).toEqualTypeOf<Contact>();
    expectTypeOf(react.useMutation(invokeMutation(client.next)).data).toEqualTypeOf<Contact | undefined>();

    // Spreading to add callbacks
    react.useMutation({ ...setMutation(contact), onSuccess: (data: Contact | undefined) => data?.name });
}

export function solidQueries() {
    expectTypeOf(solid.useQuery(() => readQuery(contact)).data).toEqualTypeOf<Contact | undefined>();
    expectTypeOf(solid.useInfiniteQuery(() => readRangeInfiniteQuery(client.contacts, 20)).data?.pages).toEqualTypeOf<PartialResponse<Contact>[] | undefined>();
    expectTypeOf(solid.useMutation(() => setMutation(contact)).mutate).parameter(0).toEqualTypeOf<Contact>();
}

export async function core(queryClient: QueryClient) {
    expectTypeOf(await queryClient.fetchQuery(readQuery(contact))).toEqualTypeOf<Contact>();
    expectTypeOf(queryClient.getQueryData(readQuery(contact).queryKey)).toEqualTypeOf<Contact | undefined>();
}
