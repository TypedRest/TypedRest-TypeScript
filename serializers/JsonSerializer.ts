import { Serializer } from ".";

/**
 * Serializes and deserializes entities as JSON.
 */
export class JsonSerializer implements Serializer {
    /**
     * @inheritdoc
     */
    readonly supportedMediaTypes = ["application/json"];

    /**
     * @inheritdoc
     */
    serialize<T>(entity: T) {
        return JSON.stringify(entity);
    }

    /**
     * @inheritdoc
     */
    deserialize<T>(text: string) {
        return JSON.parse(text) as T;
    }
}
