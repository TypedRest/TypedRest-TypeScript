# TypedRest for TanStack Query

Use [TypedRest](https://typedrest.net/) endpoints with [TanStack Query](https://tanstack.com/query) in React, Solid, Vue, Svelte and Angular.

This package turns TypedRest endpoints into TanStack query and mutation options:

- **Typed:** entity types flow from your endpoints into `data` and the mutation variables.
- **Cancelable:** TanStack's `AbortSignal` is passed straight into TypedRest, so requests and streams stop when a query is canceled or no longer used.
- **Hierarchical keys:** query keys follow the endpoint URLs, so invalidating a collection also invalidates its elements and their children.
- **Lost-update protection:** ETags are kept per URL, and edit forms can save against the version they started from. Conflicts surface as TypedRest's `ConcurrencyError`.

The helpers return plain option objects, so the same code works with every TanStack adapter.

## Install

```bash
npm install typedrest typedrest-tanstack-query @tanstack/react-query
```

Replace `@tanstack/react-query` with the adapter for your framework: `@tanstack/solid-query`, `@tanstack/vue-query`, `@tanstack/svelte-query` or `@tanstack/angular-query`

## Define your client

Build your TypedRest client as usual:

```ts
import { EntryEndpoint } from "typedrest";
import { CollectionEndpoint } from "typedrest/endpoints/generic";
import { ActionEndpoint } from "typedrest/endpoints/rpc";
import { StreamingEndpoint } from "typedrest/endpoints/reactive";

export interface Contact { id: string; name: string; }

export class MyClient extends EntryEndpoint {
    constructor() { super(new URL("https://api.example.com/")); }

    readonly contacts = new CollectionEndpoint<Contact>(this, "contacts");
    readonly reindex = new ActionEndpoint(this, "reindex");
    readonly events = new StreamingEndpoint<Contact>(this, "events");
}
```

## React

Create a typed context for the client once, and render the provider inside TanStack's `QueryClientProvider`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClientContext } from "typedrest-tanstack-query/react";

export const { ClientProvider, useClient } = createClientContext<MyClient>();

const queryClient = new QueryClient();

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ClientProvider client={new MyClient()}>
                <ContactList />
            </ClientProvider>
        </QueryClientProvider>
    );
}
```

Pass the helpers to TanStack's hooks:

```tsx
import { useMutation, useQuery } from "@tanstack/react-query";
import { createMutation, invokeMutation, readAllQuery } from "typedrest-tanstack-query";

function ContactList() {
    const client = useClient();
    const contacts = useQuery(readAllQuery(client.contacts)); // data: Contact[] | undefined
    const create = useMutation(createMutation(client.contacts)); // mutate(entity: Contact)
    const reindex = useMutation(invokeMutation(client.reindex)); // mutate()

    if (contacts.isPending) return <p>Loading…</p>;
    if (contacts.isError) return <p>{contacts.error.message}</p>;
    return (
        <>
            <ul>{contacts.data.map(c => <li key={c.id}>{c.name}</li>)}</ul>
            <button onClick={() => create.mutate({ id: "", name: "New contact" })}>Add</button>
            <button onClick={() => reindex.mutate()}>Reindex</button>
        </>
    );
}
```

After `create` succeeds, the collection is refetched. If the server returned the new element, it is put into the cache for that element's `readQuery`.

### Edit forms

Capture the version of the entity when the form opens, and save against it:

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ElementEndpoint } from "typedrest/endpoints/generic";
import { ConcurrencyError } from "typedrest/errors";
import { readQuery, setMutation, versionOf } from "typedrest-tanstack-query";

function EditContact({ id }: { id: string; }) {
    const contact = useClient().contacts.get(id);
    const query = useQuery(readQuery(contact));
    if (!query.data) return <p>Loading…</p>;
    // Background refetches update query.data, but the form keeps its draft and version
    return <ContactForm key={id} contact={contact} initial={query.data} />;
}

function ContactForm({ contact, initial }: { contact: ElementEndpoint<Contact>; initial: Contact; }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState(initial);
    const [basedOn, setBasedOn] = useState(() => versionOf(initial));
    const save = useMutation({
        ...setMutation(contact, { basedOn }),
        // Continue editing from the version that was just saved
        onSuccess: () => setBasedOn(versionOf(queryClient.getQueryData(readQuery(contact).queryKey)))
    });

    return (
        <form onSubmit={e => { e.preventDefault(); save.mutate(draft); }}>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            {save.error instanceof ConcurrencyError && <p>Someone else changed this contact. Reload to see their changes.</p>}
            <button disabled={save.isPending}>Save</button>
        </form>
    );
}
```

`setMutation` finishes only after the affected queries have refetched, so `onSuccess` sees the saved version in the cache.

If `basedOn` is `undefined`, because the data has no known version, the save sends no precondition. Without the `basedOn` option at all, `setMutation` sends the ETag of the most recent read. If the query refetched in the background while the user was editing, that could silently overwrite someone else's change.

## Solid

Solid components run once, so there is no need for a context: create the client at module level, or pass it as a prop. Wrap the helpers in a function so Solid can track signals such as `props.id`:

```tsx
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/solid-query";
import { createSignal, Match, Switch } from "solid-js";
import { readQuery, setMutation, streamQuery, versionOf } from "typedrest-tanstack-query";

const client = new MyClient();
const queryClient = new QueryClient();

function ContactName(props: { id: string; }) {
    const query = useQuery(() => readQuery(client.contacts.get(props.id)));
    return (
        <Switch>
            <Match when={query.isPending}>Loading…</Match>
            <Match when={query.isError}>{query.error?.message}</Match>
            <Match when={query.data}>{data => <span>{data().name}</span>}</Match>
        </Switch>
    );
}

function RenameContact(props: { id: string; initial: Contact; }) {
    const [name, setName] = createSignal(props.initial.name);
    const basedOn = versionOf(props.initial);
    const save = useMutation(() => setMutation(client.contacts.get(props.id), { basedOn }));
    return (
        <form onSubmit={e => { e.preventDefault(); save.mutate({ ...props.initial, name: name() }); }}>
            <input value={name()} onInput={e => setName(e.currentTarget.value)} />
            <button disabled={save.isPending}>Save</button>
        </form>
    );
}

function LiveEvents() {
    // Keeps the connection open while the component is mounted
    const events = useQuery(() => streamQuery(client.events));
    return <ul>{events.data?.map(e => <li>{e.name}</li>)}</ul>;
}

export const App = () => (
    <QueryClientProvider client={queryClient}>
        <ContactName id="1" />
        <LiveEvents />
    </QueryClientProvider>
);
```

Vue, Svelte and Angular work the same way: pass `readQuery(...)` to `useQuery()`, or `() => readQuery(...)` to `createQuery()` / `injectQuery()`.

## Queries

| Helper | Calls | `data` |
|---|---|---|
| `readQuery(element)` | `read()` | `TEntity` |
| `existsQuery(element)` | `exists()` | `boolean` |
| `readAllQuery(collection)` | `readAll()` | `TEntity[]` |
| `readRangeQuery(collection, from?, to?)` | `readRange()` | `PartialResponse<TEntity>` |
| `readRangeInfiniteQuery(collection, pageSize)` | `readRange()` per page, for `useInfiniteQuery()` | `InfiniteData<PartialResponse<TEntity>>` |
| `probeQuery(rpcOrBlob)` | `probe()` | the endpoint's `*Allowed` flags |
| `readMetaQuery(entry)` | `readMeta()` | `null` |
| `downloadQuery(blob)` | `download()` | `Blob` |

Add or override options by spreading: `useQuery({ ...readQuery(contact), staleTime: 60_000 })`.

Refetches send the cached ETag. If nothing changed, the server answers `304 Not Modified`, and TanStack keeps the existing `data` object, so nothing re-renders.

## Mutations

| Helper | `mutate(...)` | `data` | Invalidates by default |
|---|---|---|---|
| `setMutation(element, { basedOn? })` | `TEntity` | `TEntity \| undefined` | `lineage` |
| `mergeMutation(element)` | `Partial<TEntity>` | `TEntity \| undefined` | `lineage` |
| `updateMutation(element, { maxRetries? })` | `(entity: TEntity) => void` | `TEntity \| undefined` | `lineage` |
| `deleteMutation(element, { basedOn? })` | nothing | `void` | removes the element's queries, then `ancestors` |
| `createMutation(collection)` | `TEntity` | the new element's endpoint, or `undefined` | `ancestors` |
| `createAllMutation(collection)` | `TEntity[]` | `void` | `subtree` |
| `setAllMutation(collection, { basedOn? })` | `TEntity[]` | `void` | `subtree` |
| `invokeMutation(action \| consumer \| function \| producer)` | input or nothing | result or `void` | `parent` |
| `uploadMutation(blob \| upload)` | `Blob` | `void` | `lineage` / `parent` |

Invalidation scopes, relative to the endpoint the mutation was made on:

- `self`: the endpoint itself.
- `subtree`: the endpoint and everything below it.
- `ancestors`: the endpoint and everything above it.
- `lineage`: both of the above, but not siblings. Changing `contacts/5` refetches `contacts` and `contacts/5/note`, but not `contacts/6`.
- `parent`: everything below the endpoint's parent.

Override the scope with `{ invalidate: "self" }` or `{ invalidate: false }`, and add other endpoints with `{ alsoInvalidate: [otherEndpoint] }`. Streaming queries are never invalidated automatically.

Invalidation runs inside `mutationFn`, so you can add your own callbacks by spreading: `useMutation({ ...setMutation(contact), onSuccess: () => navigate("/") })`.

Errors from TypedRest pass through unchanged, so you can check for `ConcurrencyError`, `NotFoundError`, `BadRequestError` and so on.

## Streaming

| Helper | Calls | `data` |
|---|---|---|
| `streamQuery(streaming \| sse)` | `stream()` | `TEntity[]` (or your own shape with `{ reducer, initialValue }`) |
| `streamCollectionQuery(streamingCollection, startIndex?)` | `stream()` | `TEntity[]` |
| `pollQuery(polling)` | `stream()` | the latest `TEntity` |

These are built on TanStack's `streamedQuery`, which TanStack still marks as experimental. Streams close when the query is canceled or its last observer unsubscribes. They default to `staleTime: Infinity`, so they are not restarted when the window regains focus.

## Endpoint instances and ETags

TypedRest keeps ETags and capabilities (such as `setAllowed`) on endpoint objects. This package shares one endpoint instance per URL, endpoint class and HTTP client within a `QueryClient`, so you can create endpoints freely, for example on every render. Use `endpointFor(queryClient, endpoint)` to read state such as `setAllowed` from that shared instance. Shared instances are dropped once TanStack has removed every query for their URL.

If you create an endpoint with different settings for the same URL and class (such as a `PollingEndpoint`'s end condition), the settings of the first instance a query used apply.

`versionOf(data)` returns the version a query's data was read from. It is `undefined` for data that is not an object, for responses without an ETag, and for data restored from a persisted cache or server-side rendering. In that case a save sends no precondition.

Pass a version only to mutations on the endpoint it was read from. For example, `versionOf()` of a `readAllQuery` describes the whole collection, so passing it to `setMutation` for one element throws an error instead of sending a precondition that can never match.

## Query keys

`endpointKey(endpoint)` returns the origin followed by the URL's path segments, e.g. `["https://api.example.com", "contacts", "5"]`. Query keys append the operation: `[..., { typedrest: "read" }]`. Use `invalidateEndpoint(queryClient, endpoint, scope?)` to invalidate by endpoint yourself.
