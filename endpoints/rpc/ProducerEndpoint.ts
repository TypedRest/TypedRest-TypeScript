import { RpcEndpointBase } from "./RpcEndpointBase";
import { Endpoint } from "../Endpoint";
import { HttpMethod } from "../../http";

/**
 * RPC endpoint that returns `TResult` as output when invoked.
 * @typeParam TResult The type of entity the endpoint returns as output.
 */
export class ProducerEndpoint<TResult> extends RpcEndpointBase {
    /**
     * Creates a new producer endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri);
    }

    /**
     * Gets a result from the producer.
     * @param signal Used to cancel the request.
     * @returns The `TResult` returned by the server.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async invoke(signal?: AbortSignal): Promise<TResult> {
        const response = await this.send(HttpMethod.Post, signal);
        return this.serializer.deserialize<TResult>(await response.text());
    }
}
