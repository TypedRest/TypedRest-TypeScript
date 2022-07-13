import { RpcEndpointBase } from "./RpcEndpointBase";
import { Endpoint } from "../Endpoint";
import { HttpMethod } from "../../http";

/**
 * RPC endpoint that is invoked with no input or output.
 */
export class ActionEndpoint extends RpcEndpointBase {
    /**
     * Creates a new action endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri);
    }

    /**
     * Invokes the action.
     * @param signal Used to cancel the request.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async invoke(signal?: AbortSignal) {
        await this.send(HttpMethod.Post, signal);
    }
}
