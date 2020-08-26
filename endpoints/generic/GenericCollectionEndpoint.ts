import { ETagEndpointBase } from ".";
import { Endpoint } from "../Endpoint";
import { CachingEndpoint } from "../CachingEndpoint";
import { HttpMethod, HttpHeader, ResponseCache } from "../../http";

/**
 * Endpoint for a collection of `TEntity`s addressable as `TElementEndpoint`s.
 * @typeParam TEntity The type of individual elements in the collection.
 * @typeParam TElementEndpoint The type of {@link Endpoint}s to provide for individual `TEntity`s.
 */
export class GenericCollectionEndpoint<TEntity, TElementEndpoint extends Endpoint> extends ETagEndpointBase {
    /**
     * Creates a new collection endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     * @param elementEndpoint A factory method for creating instances of `TElementEndpoint`.
     */
    protected constructor(referrer: Endpoint, relativeUri: URL | string, private readonly elementEndpoint: new (referrer: Endpoint, uri: URL) => TElementEndpoint) {
        super(referrer, relativeUri);
        this.setDefaultLinkTemplate("child", "./{id}");
    }

    /**
     * Returns an `TElementEndpoint` for a specific child element.
     * @param element The ID identifying the entity or an entity to extract the ID from.
     */
    get(element: (TEntity | string)): TElementEndpoint {
        let id: string;
        if (typeof element === "string") {
            id = element;
        } else {
            id = (element as any).id;
            if (id == null) throw new Error(`Element ${element} does not have an id property.`);
        }

        return new this.elementEndpoint(this, this.linkTemplate("child", { id }));
    }

    /**
     * Shows whether the server has indicated that {@link readAll} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` If no request has been sent yet or the server did not specify allowed methods.
     */
    get readAllAllowed() { return this.isMethodAllowed(HttpMethod.Get); }

    async readAll() { return this.serializer.deserialize<TEntity[]>(await this.getContent()); }

    /**
     * Shows whether the server has indicated that {@link create} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` If no request has been sent yet or the server did not specify allowed methods.
     */
    get createAllowed() { return this.isMethodAllowed(HttpMethod.Post); }

    /**
     * Adds a `TEntity` as a new element to the collection.
     * @param entity The new `TEntity`.
     * @returns The `TEntity` as returned by the server, possibly with additional fields set. undefined if the server does not respond with a result entity.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link ConflictError}: {@link HttpStatusCode.Conflict}
     * @throws {@link HttpError}: Other non-success status code
     */
    async create(entity: TEntity): Promise<TElementEndpoint> {
        const response = await this.send(HttpMethod.Post, {
            [HttpHeader.ContentType]: this.serializer.supportedMediaTypes[0]
        }, this.serializer.serialize(entity));

        const location = response.headers.get(HttpHeader.Location);
        const elementEndpoint = location
            ? new this.elementEndpoint(this, this.join(location))
            : this.get(this.serializer.deserialize(await response.clone().text()));
        (elementEndpoint as CachingEndpoint).responseCache = await ResponseCache.from(response);
        return elementEndpoint;
    }

    /**
     * Shows whether the server has indicated that {@link createAll} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` If no request has been sent yet or the server did not specify allowed methods.
     */
    get createAllAllowed() { return this.isMethodAllowed(HttpMethod.Patch); }

    /**
     * Adds (or updates) multiple `TEntity`s as elements in the collection.
     * @param entities The `TEntity`s to create or modify.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link ConflictError}: {@link HttpStatusCode.Conflict}
     * @throws {@link HttpError}: Other non-success status code
     */
    async createAll(entities: TEntity[]) {
        await this.send(HttpMethod.Patch, {
            [HttpHeader.ContentType]: this.serializer.supportedMediaTypes[0]
        }, this.serializer.serialize(entities));
    }

    /**
     * Shows whether the server has indicated that {@link setAll} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` If no request has been sent yet or the server did not specify allowed methods.
     */
    get setAllAllowed() { return this.isMethodAllowed(HttpMethod.Put); }

    /**
     *  Replaces the entire content of the collection with new `TEntity`s.
     * @param entities The `TEntity`s to create or modify.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link ConflictError}: {@link HttpStatusCode.Conflict}
     * @throws {@link HttpError}: Other non-success status code
     */
    async setAll(entities: TEntity[]) { await this.putContent(entities); }
}
