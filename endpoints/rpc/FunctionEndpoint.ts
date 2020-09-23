import { RpcEndpointBase } from ".";
import { Endpoint } from "../Endpoint";
import { HttpMethod, HttpHeader } from "../../http";

/**
 * RPC endpoint that takes `TEntity` as input and returns `TResult` as output when invoked.
 * @typeParam TEntity The type of entity the endpoint takes as input.
 * @typeParam TResult The type of entity the endpoint returns as output.
 */
export class FunctionEndpoint<TEntity, TResult> extends RpcEndpointBase {
    /**
     * Creates a new function endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri);
    }

    /**
     * Invokes the function.
     * @param entity The `TEntity` to post as input.
     * @param signal Used to cancel the request.
     * @returns The `TResult` returned by the server.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async invoke(entity: TEntity, signal?: AbortSignal): Promise<TResult> {
        const response = await this.send(HttpMethod.Post, signal, {
            [HttpHeader.ContentType]: this.serializer.supportedMediaTypes[0]
        }, this.serializer.serialize(entity));

        return this.serializer.deserialize<TResult>(await response.text());
    }
}
