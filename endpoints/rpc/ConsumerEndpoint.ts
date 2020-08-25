import { RpcEndpointBase } from ".";
import { Endpoint } from "../Endpoint";
import { HttpMethod, HttpHeader } from "../../http";

/**
 * RPC endpoint that takes `TEntity` as input when invoked.
 * @typeParam TEntity The type of entity the endpoint takes as input.
 */
export class ConsumerEndpoint<TEntity> extends RpcEndpointBase {
    /**
     * Creates a new consumer endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri);
    }

    /**
     * Sends the entity to the consumer.
     * @param entity The `TEntity` to post as input.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async invoke(entity: TEntity): Promise<void> {
        await this.send(HttpMethod.Post, {
            [HttpHeader.ContentType]: this.serializer.supportedMediaTypes[0]
        }, this.serializer.serialize(entity));
    }
}
