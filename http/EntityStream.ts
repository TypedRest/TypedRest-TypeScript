import { Serializer } from "../serializers";

/**
 * Exposes the body of a `Response` as a stream of deserialized entities.
 * @typeParam TEntity The type of entity the stream provides.
 * @param response The response to read the body from.
 * @param serializer Controls the deserialization of the entities in the body.
 * @param separator The character sequence used to detect that a new entity starts in the stream.
 * @returns A stream that ends when the server closes the connection.
 */
export async function* entityStream<TEntity>(response: Response, serializer: Serializer, separator: string = "\n"): AsyncIterableIterator<TEntity> {
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let index: number;
            while ((index = buffer.indexOf(separator)) !== -1) {
                const entity = buffer.slice(0, index);
                buffer = buffer.slice(index + separator.length);
                if (entity.trim()) yield serializer.deserialize<TEntity>(entity);
            }
        }

        // Tolerate a missing separator after the last entity
        buffer += decoder.decode();
        if (buffer.trim()) yield serializer.deserialize<TEntity>(buffer);
    } finally {
        // NOTE: Ignore errors here so that a failure that already ended the stream is not masked.
        await reader.cancel().catch(() => { });
    }
}
