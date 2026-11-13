# ![TypedRest](https://raw.githubusercontent.com/TypedRest/TypedRest-TypeScript/master/logo.svg) for TypeScript

[![Build](https://github.com/TypedRest/TypedRest-TypeScript/actions/workflows/build.yml/badge.svg)](https://github.com/TypedRest/TypedRest-TypeScript/actions/workflows/build.yml)
[![API documentation](https://img.shields.io/badge/api-docs-orange.svg)](https://typescript.typedrest.net/)
[![TypedRest](https://img.shields.io/npm/v/typedrest.svg)](https://www.npmjs.com/package/typedrest)

**Describe your REST API as a tree of endpoints, not a list of HTTP calls.**

TypedRest helps you build type-safe, fluent-style REST API clients. Common REST patterns are represented as classes that you compose to mirror the URL structure of your API.

Tell TypedRest that `/contacts` is a collection and get type-safe listing, creating, reading, updating and deleting in return. Unlike typical generated clients, which give you one flat method per operation, TypedRest gives you a navigable tree of endpoints.

## Define your client

A few lines are enough to describe an API with a collection of contacts plus a "notes" endpoint nested underneath:

```typescript
class MyClient extends EntryEndpoint {
  get contacts() {
    return new ContactCollectionEndpoint(this);
  }
}

class ContactCollectionEndpoint extends GenericCollectionEndpoint<Contact, ContactEndpoint> {
  constructor(referrer: Endpoint) {
    super(referrer, "./contacts", ContactEndpoint);
  }
}

class ContactEndpoint extends ElementEndpoint<Contact> {
  get note() {
    return new ElementEndpoint<Note>(this, "./note");
  }
}
```

## Use it

Navigate the API like an object model, with code completion guiding the way:

```typescript
const client = new MyClient(new URL("http://example.com/"));

// GET /contacts
const contactList: Contact[] = await client.contacts.readAll();

// POST /contacts -> Location: /contacts/1337
const smith: ContactEndpoint = await client.contacts.create({name: "Smith"});
//const smith: ContactEndpoint = client.contacts.get("1337");

// GET /contacts/1337
const contact: Contact = await smith.read();

// PUT /contacts/1337/note
await smith.note.set({content: "some note"});

// GET /contacts/1337/note
const note: Note = await smith.note.read();

// DELETE /contacts/1337
await smith.delete();
```

## Learn more

Read a more detailed **[Introduction](https://typedrest.net/introduction/)** to TypedRest or jump right in with the **[setup guide](https://typedrest.net/setup/typescript/)**.  
You can also **[build your first client](https://typedrest.net/tutorials/first-client/)** step by step or **[generate one from OpenAPI](https://typedrest.net/tutorials/from-openapi/)**.

Take a look at our [Sample project](https://github.com/TypedRest/Sample-TypeScript) to see TypedRest in action.
