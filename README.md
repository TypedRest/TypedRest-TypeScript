# ![TypedRest](https://raw.githubusercontent.com/TypedRest/TypedRest-TypeScript/master/logo.svg) for TypeScript

[![TypedRest](https://img.shields.io/npm/v/typedrest.svg)](https://www.npmjs.com/package/typedrest)
[![API documentation](https://img.shields.io/badge/api-docs-orange.svg)](https://typescript.typedrest.net/)
[![Build](https://github.com/TypedRest/TypedRest-TypeScript/actions/workflows/build.yml/badge.svg)](https://github.com/TypedRest/TypedRest-TypeScript/actions/workflows/build.yml)  
TypedRest helps you build type-safe, fluent-style REST API clients. Common REST patterns such as collections are represented as classes, allowing you to write more idiomatic code.

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

Read a more detailed **[Introduction](https://typedrest.net/introduction/)** to TypedRest or jump right in with the **[Getting started](https://typedrest.net/getting-started/typescript/)** guide.
