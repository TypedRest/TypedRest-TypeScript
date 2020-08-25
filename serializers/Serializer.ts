/**
 * Controls the serialization of entities sent to and received from the server.
 */
export interface Serializer {
    /**
     * A list of MIME types this serializer supports.
     */
    readonly supportedMediaTypes: string[];

    /**
     * Serializes an entity.
     * @typeParam T The type of entity to serialize.
     * @param entity The entity to serialize.
     */
    serialize<T>(entity: T): string;

    /**
     * Deserializes an entity.
     * @typeParam T The type of entity to deserialize.
     * @param text The string to deserialize into an entity.
     */
    deserialize<T>(text: string): T;
}
