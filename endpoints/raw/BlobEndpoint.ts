import { Endpoint } from "../Endpoint";
import { HttpMethod, HttpHeader } from "../../http";

export class BlobEndpoint extends Endpoint {
    /**
     * Creates a new blob endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string) {
        super(referrer, relativeUri);
    }

    /**
     * Queries the server about capabilities of the endpoint without performing any action.
     * @param signal Used to cancel the request.
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async probe(signal?: AbortSignal) {
        await this.send(HttpMethod.Options, signal);
    }

    /**
     * Shows whether the server has indicated that {@link download} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get downloadAllowed() { return this.isMethodAllowed(HttpMethod.Get); }

    /**
     * Downloads the blob's content.
     * @param signal Used to cancel the request.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async download(signal?: AbortSignal): Promise<Blob> {
        const response = await this.send(HttpMethod.Get, signal);
        return response.blob();
    }

    /**
     * Shows whether the server has indicated that {@link upload} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get uploadAllowed() { return this.isMethodAllowed(HttpMethod.Put); }

    /**
     * Uploads data as the blob's content.
     * @param blob The blob to read the upload data from.
     * @param signal Used to cancel the request.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link HttpError}: Other non-success status code
     */
    async upload(blob: Blob, signal?: AbortSignal) {
        await this.send(HttpMethod.Put, signal, { [HttpHeader.ContentType]: blob.type }, blob);
    }

    /**
     * Shows whether the server has indicated that {@link delete} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get deleteAllowed() { return this.isMethodAllowed(HttpMethod.Delete); }

    /**
     * Deletes the blob from the server.
     * @param signal Used to cancel the request.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async delete(signal?: AbortSignal) {
        await this.send(HttpMethod.Delete, signal);
    }
}
