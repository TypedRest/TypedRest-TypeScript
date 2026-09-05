import { Endpoint } from "../Endpoint";
import { delay } from "./Delay";
import { HttpMethod, HttpHeader, HttpStatusCode, SseReader } from "../../http";

const eventStreamMediaType = "text/event-stream";

/**
 * Endpoint for a stream of `TEntity`s using Server-Sent Events (SSE).<br>
 * Sends `Accept: text/event-stream`. By default, transparently reconnects on connection drops or transient errors,
 * honoring the server-supplied `retry:` interval and resuming via the {@link http!HttpHeader.LastEventId} header.
 * @typeParam TEntity The type of individual elements in the stream.
 */
export class SseStreamingEndpoint<TEntity> extends Endpoint {
    /**
     * Creates a new SSE streaming endpoint.
     * @param referrer The endpoint used to navigate to this one.
     * @param relativeUri The URI of this endpoint relative to the `referrer`'s. Add a `./` prefix here to imply a trailing slash in the `referrer`'s URI.
     * @param eventType If set, only events with this `event:` type are provided; others are ignored. Leave unspecified to provide all events.
     */
    constructor(referrer: Endpoint, relativeUri: URL | string, private readonly eventType?: string) {
        super(referrer, relativeUri);
    }

    /**
     * Whether to transparently reconnect on connection drops, transient transport errors and 5xx responses.
     */
    autoReconnect = true;

    /**
     * The reconnection interval in milliseconds used when the server has not (yet) supplied one via the SSE `retry:` field.
     */
    defaultReconnectionInterval = 3000;

    /**
     * Provides a stream of `TEntity`s, reconnecting as needed unless {@link autoReconnect} is disabled.
     * @param signal Used to close the connection.
     * @throws {@link errors!AuthenticationError}: {@link http!HttpStatusCode.Unauthorized}
     * @throws {@link errors!AuthorizationError}: {@link http!HttpStatusCode.Forbidden}
     * @throws {@link errors!NotFoundError}: {@link http!HttpStatusCode.NotFound} or {@link http!HttpStatusCode.Gone}
     * @throws {@link errors!HttpError}: Other non-success status code
     */
    async *stream(signal?: AbortSignal): AsyncIterableIterator<TEntity> {
        const state = { lastEventId: undefined as string | undefined, reconnectionInterval: this.defaultReconnectionInterval };

        while (!signal?.aborted) {
            let reconnect: boolean;
            try {
                reconnect = yield* this.consumeOnce(state, signal);
            } catch (err) {
                // Aborting is a regular way of ending the stream, not an error
                if (signal?.aborted) return;

                // Transport-level failures are the ones worth retrying; anything else is the server telling us no
                if (!this.autoReconnect || !SseStreamingEndpoint.isTransient(err)) throw err;
                reconnect = true;
            }

            if (!reconnect) return;
            if (!await delay(state.reconnectionInterval, signal)) return;
        }
    }

    /**
     * Provides a stream of `TEntity`s using {@link stream}.
     */
    [Symbol.asyncIterator]() { return this.stream(); }

    /**
     * Opens a connection and provides events until the stream ends.
     * @param state Carries the last event id and the reconnection interval over to the next attempt.
     * @param signal Used to close the connection.
     * @returns `true` if another connection attempt should be made; `false` if the stream has ended for good.
     */
    private async *consumeOnce(state: { lastEventId?: string; reconnectionInterval: number; }, signal?: AbortSignal): AsyncGenerator<TEntity, boolean> {
        // NOTE: Abort the request when the consumer stops iterating, not just when the caller's signal fires.
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        signal?.addEventListener("abort", onAbort, { once: true });
        if (signal?.aborted) controller.abort();

        try {
            const headers = new Headers({ [HttpHeader.Accept]: eventStreamMediaType });
            if (state.lastEventId) headers.set(HttpHeader.LastEventId, state.lastEventId);

            const response = await this.httpClient.send(this.uri, HttpMethod.Get, controller.signal, headers);
            if (response.status === HttpStatusCode.NoContent) return false;
            if (this.autoReconnect && response.status >= 500) return true;
            await this.handle(response);

            const reader = new SseReader(response);
            try {
                for await (const event of reader.events()) {
                    if (this.eventType !== undefined && event.type !== this.eventType) continue;
                    yield this.serializer.deserialize<TEntity>(event.data);
                }
            } finally {
                state.lastEventId = reader.lastEventId ?? state.lastEventId;
                if (reader.reconnectionInterval !== undefined) state.reconnectionInterval = reader.reconnectionInterval;
            }

            return this.autoReconnect;
        } finally {
            signal?.removeEventListener("abort", onAbort);
            controller.abort();
        }
    }

    /**
     * Determines whether an error is a transport-level failure that may succeed on a retry.
     * The Fetch API reports these as `TypeError`s, while responses the server actually sent become {@link errors!HttpError}s.
     */
    private static isTransient(err: unknown) {
        return err instanceof TypeError;
    }
}
