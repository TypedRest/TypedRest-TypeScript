/**
 * Yields the lines terminated by `\n`, `\r\n` or `\r` within the first `limit` characters of `buffer`.
 * @returns The remaining characters that are not part of a terminated line.
 */
function* splitLines(buffer: string, limit: number): Generator<string, string> {
    let start = 0;

    for (let index = 0; index < limit; index++) {
        const char = buffer[index];
        if (char !== "\n" && char !== "\r") continue;

        yield buffer.slice(start, index);
        if (char === "\r" && buffer[index + 1] === "\n") index++;
        start = index + 1;
    }

    return buffer.slice(start);
}

/**
 * A single event read from a Server-Sent Events (SSE) stream.
 */
export class ServerSentEvent {
    /**
     * Creates a new event.
     * @param type The event type from the `event:` field. {@link defaultEventType} if the server did not specify one.
     * @param data The concatenated content of the event's `data:` fields.
     * @param id The id of the most recent `id:` field if any.
     */
    constructor(public readonly type: string, public readonly data: string, public readonly id?: string) {
    }
}

/**
 * The event type used for events without an explicit `event:` field.
 */
export const defaultEventType = "message";

/**
 * Reads {@link ServerSentEvent}s from the body of a `Response` in the `text/event-stream` format.
 */
export class SseReader {
    /**
     * Creates a new reader.
     * @param response The response to read the body from.
     */
    constructor(private readonly response: Response) {
    }

    private _lastEventId?: string;

    /**
     * The id of the most recent event that carried an `id:` field.<br>
     * Send this back as a {@link HttpHeader.LastEventId} header when reconnecting to let the server resume where it left off.
     */
    get lastEventId() { return this._lastEventId; }

    private _reconnectionInterval?: number;

    /**
     * The reconnection interval in milliseconds most recently requested by the server via a `retry:` field if any.
     */
    get reconnectionInterval() { return this._reconnectionInterval; }

    /**
     * Reads events until the stream ends.<br>
     * Any event that is still incomplete when the stream ends is discarded.
     */
    async *events(): AsyncIterableIterator<ServerSentEvent> {
        let type: string | undefined;
        let data = "";

        for await (const line of this.lines()) {
            if (line === "") {
                // A blank line dispatches the event collected so far
                if (data !== "") {
                    // Every data field appended a trailing newline; the last one is not part of the payload
                    yield new ServerSentEvent(type ?? defaultEventType, data.slice(0, -1), this._lastEventId);
                    data = "";
                }
                type = undefined;
                continue;
            }

            // Lines starting with a colon are comments, e.g. the ":ping" some servers send to keep the connection alive
            if (line.startsWith(":")) continue;

            const colonIndex = line.indexOf(":");
            const field = (colonIndex === -1) ? line : line.slice(0, colonIndex);
            const value = (colonIndex === -1) ? ""
                : line.slice((line[colonIndex + 1] === " ") ? colonIndex + 2 : colonIndex + 1);

            switch (field) {
                case "event":
                    type = value;
                    break;
                case "data":
                    data += value + "\n";
                    break;
                case "id":
                    if (value.indexOf("\0") === -1) this._lastEventId = value;
                    break;
                case "retry":
                    if (/^\d+$/.test(value)) this._reconnectionInterval = parseInt(value);
                    break;
            }
        }
    }

    /**
     * Splits the response body into lines, accepting `\n`, `\r\n` and `\r` as terminators.
     */
    private async *lines(): AsyncIterableIterator<string> {
        if (!this.response.body) return;

        const reader = this.response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let stripBom = true;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                if (stripBom && buffer !== "") {
                    if (buffer.charCodeAt(0) === 0xFEFF) buffer = buffer.slice(1);
                    stripBom = false;
                }

                // NOTE: Keep a trailing "\r" buffered; it may still be followed by a "\n" in the next chunk.
                buffer = yield* splitLines(buffer, buffer.endsWith("\r") ? buffer.length - 1 : buffer.length);
            }

            // NOTE: A line that is still unterminated once the stream ends is discarded.
            buffer += decoder.decode();
            yield* splitLines(buffer, buffer.length);
        } finally {
            // NOTE: Ignore errors here so that a failure that already ended the stream is not masked.
            await reader.cancel().catch(() => { });
        }
    }
}
