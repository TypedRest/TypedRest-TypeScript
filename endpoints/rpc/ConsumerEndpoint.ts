import { RpcEndpointBase } from "./RpcEndpointBase";
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
     * @param signal Used to cancel the request.
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    async invoke(entity: TEntity, signal?: AbortSignal) {
        await this.send(HttpMethod.Post, signal, {
            [HttpHeader.ContentType]: this.serializer.supportedMediaTypes[0]
        }, this.serializer.serialize(entity));
    }
}
