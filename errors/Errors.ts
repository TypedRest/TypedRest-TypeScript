import { HttpStatusCode } from "../http";

/* tslint:disable:max-classes-per-file */

export class HttpError extends Error {
    constructor(message: string, public status: HttpStatusCode) {
        super(message);
    }
}

export class BadRequestError extends HttpError {
    constructor(message: string, status = HttpStatusCode.BadRequest) {
        super(message, status);
    }
}

export class AuthenticationError extends HttpError {
    constructor(message: string, status = HttpStatusCode.Unauthorized) {
        super(message, status);
    }
}

export class AuthorizationError extends HttpError {
    constructor(message: string, status = HttpStatusCode.Forbidden) {
        super(message, status);
    }
}

export class NotFoundError extends HttpError {
    constructor(message: string, status = HttpStatusCode.NotFound) {
        super(message, status);
    }
}

export class TimeoutError extends HttpError {
    constructor(message: string, status = HttpStatusCode.RequestTimeout) {
        super(message, status);
    }
}

export class ConflictError extends HttpError {
    constructor(message: string, status = HttpStatusCode.Conflict) {
        super(message, status);
    }
}

export class ConcurrencyError extends HttpError {
    constructor(message: string, status = HttpStatusCode.PreconditionFailed) {
        super(message, status);
    }
}

export class RangeError extends HttpError {
    constructor(message: string, status = HttpStatusCode.RequestedRangeNotSatisfiable) {
        super(message, status);
    }
}
