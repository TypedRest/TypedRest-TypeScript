import { Endpoint } from "../Endpoint";
import { HttpMethod, HttpHeader } from "../../http";

/**
 * Endpoint that accepts binary uploads using multi-part form encoding or raw bodies.
 */
export class UploadEndpoint extends Endpoint {
    /**
     * Creates a new upload endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     * @param formField The name of the form field to place the uploaded data into; leave unspecified to use raw bodies instead of a multi-part forms.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string, private readonly formField?: string) {
        super(referrer, relativeUri);
        this.formField = formField;
    }

    /**
     * Uploads data to the endpoint.
     * @param blob The blob or file to read the upload data from.
     * @param signal Used to cancel the request.
     * @throws {@link errors!BadRequestError}: {@link http!HttpStatusCode.BadRequest}
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    async uploadFrom(blob: Blob | File, signal?: AbortSignal) {
        const fileName = blob instanceof File ? blob.name : undefined;

        if (this.formField) {
            const formData = new FormData();
            formData.set(this.formField, blob, fileName);
            await this.send(HttpMethod.Post, signal, { [HttpHeader.ContentType]: "multipart/form-data" }, formData);
        } else {
            await this.send(HttpMethod.Post, signal, { [HttpHeader.ContentType]: blob.type }, blob);
        }
    }
}
