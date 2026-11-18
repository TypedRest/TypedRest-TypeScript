import { DefaultErrorHandler, ConcurrencyError, HttpError } from '.';
import { HttpHeader, HttpStatusCode } from '../http';

const handler = new DefaultErrorHandler();

test('retryAfter', async () => {
    const response = new Response(null, {
        status: HttpStatusCode.PreconditionFailed,
        headers: { [HttpHeader.RetryAfter]: '42' }
    });
    const error = await handler.handle(response).catch(err => err);
    expect(error).toBeInstanceOf(ConcurrencyError);
    expect((error as HttpError).retryAfter).toBe(42_000);
});

test('noRetryAfter', async () => {
    const response = new Response(null, { status: HttpStatusCode.PreconditionFailed });
    const error = await handler.handle(response).catch(err => err);
    expect((error as HttpError).retryAfter).toBeUndefined();
});
