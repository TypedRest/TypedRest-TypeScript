import { replaceEqualDeep } from "@tanstack/query-core";
import type { ResponseCache } from "typedrest/http";

const versions = new WeakMap<object, ResponseCache>();

function isObject(value: unknown): value is object {
    return typeof value === "object" && value !== null;
}

/**
 * Returns the version of the resource that `data` was read from.
 * Capture this when the user starts editing and pass it as `basedOn` to {@link setMutation} or {@link deleteMutation}.
 * The server then rejects the change with a `ConcurrencyError` if someone else changed the resource since, even if the query has refetched in the meantime.
 * @param data The `data` of a query created by {@link readQuery} or {@link readAllQuery}.
 * @returns `undefined` if the data did not come from such a query, the server sent no ETag, or the data is not an object.
 */
export function versionOf(data: unknown): ResponseCache | undefined {
    return isObject(data) ? versions.get(data) : undefined;
}

/**
 * Remembers the version of the resource that `data` was read from.
 */
export function recordVersion(data: unknown, version: ResponseCache | undefined) {
    if (isObject(data) && version) versions.set(data, version);
}

/**
 * TanStack's structural sharing, extended to carry the version over to the object TanStack keeps.
 */
export function shareVersioned(oldData: unknown, newData: unknown): unknown {
    const result = replaceEqualDeep(oldData, newData);
    if (result !== newData) recordVersion(result, versionOf(newData));
    return result;
}
