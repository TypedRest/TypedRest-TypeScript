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
    serialize<T>(entity: T): string {
        return JSON.stringify(entity);
    }

    /**
     * @inheritdoc
     */
    deserialize<T>(text: string): T {
        return JSON.parse(text);
    }
}
