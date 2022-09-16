import { Serializer } from "./Serializer";

/**
 * Serializes and deserializes entities as JSON.
 */
export class JsonSerializer implements Serializer {
    /**
     * @inheritDoc
     */
    readonly supportedMediaTypes = ["application/json"];

    /**
     * @inheritDoc
     */
    serialize<T>(entity: T) {
        return JSON.stringify(entity);
    }

    /**
     * @inheritDoc
     */
    deserialize<T>(text: string) {
        return JSON.parse(text) as T;
    }
}
