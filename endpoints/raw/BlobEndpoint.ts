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
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async probe() { await this.send(HttpMethod.Options); }

    /**
     * Shows whether the server has indicated that {@link download} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get downloadAllowed() { return this.isMethodAllowed(HttpMethod.Get); }

    /**
     * Downloads the blob's content.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async download(): Promise<Blob> {
        const response = await this.send(HttpMethod.Get);
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
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link HttpError}: Other non-success status code
     */
    async upload(blob: Blob) { await this.send(HttpMethod.Put, { [HttpHeader.ContentType]: blob.type }, blob); }

    /**
     * Shows whether the server has indicated that {@link delete} is currently allowed.
     * Uses cached data from last response.
     * @returns `true` if the method is allowed, `false` if the method is not allowed, `undefined` if no request has been sent yet or the server did not specify allowed methods.
     */
    get deleteAllowed() { return this.isMethodAllowed(HttpMethod.Delete); }

    /**
     * Deletes the blob from the server.
     * @throws {@link BadRequestError}: {@link HttpStatusCode.BadRequest}
     * @throws {@link AuthenticationError}: {@link HttpStatusCode.Unauthorized}
     * @throws {@link AuthorizationError}: {@link HttpStatusCode.Forbidden}
     * @throws {@link NotFoundError}: {@link HttpStatusCode.NotFound} or {@link HttpStatusCode.Gone}
     * @throws {@link HttpError}: Other non-success status code
     */
    async delete() { await this.send(HttpMethod.Delete); }
}
