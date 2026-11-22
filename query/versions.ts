import { replaceEqualDeep } from "@tanstack/query-core";
import type { Endpoint } from "typedrest/endpoints";
import type { ResponseCache } from "typedrest/http";

const versions = new WeakMap<object, ResponseCache>();
const versionUris = new WeakMap<ResponseCache, string>();

function isObject(value: unknown): value is object {
    return typeof value === "object" && value !== null;
}

/**
 * Returns the version of the resource that `data` was read from.
 * Capture this when the user starts editing and pass it as `basedOn` to {@link setMutation}, {@link setAllMutation} or {@link deleteMutation} for the same endpoint.
 * The server then rejects the change with a `ConcurrencyError` if someone else changed the resource since, even if the query has refetched in the meantime.
 * @param data The `data` of a query created by {@link readQuery} or {@link readAllQuery}.
 * @returns `undefined` if the data did not come from such a query, the server sent no ETag, or the data is not an object.
 */
export function versionOf(data: unknown): ResponseCache | undefined {
    return isObject(data) ? versions.get(data) : undefined;
}

/**
 * Remembers the version of the resource that `data` was read from, and the endpoint it belongs to.
 */
export function recordVersion(data: unknown, version: ResponseCache | undefined, endpoint: Endpoint) {
    if (!isObject(data) || !version) return;
    versions.set(data, version);
    versionUris.set(version, endpoint.uri.href);
}

/**
 * Throws if `version` was recorded for a different endpoint than `endpoint`.
 * Versions from other sources, e.g. a `responseCache` read directly from an endpoint, are not checked.
 */
export function checkVersionBelongsTo(version: ResponseCache | undefined, endpoint: Endpoint) {
    const uri = version && versionUris.get(version);
    if (uri !== undefined && uri !== endpoint.uri.href)
        throw new Error(`basedOn is a version of ${uri}, but the change is for ${endpoint.uri.href}.`);
}

/**
 * TanStack's structural sharing, extended to carry the version over to the object TanStack keeps.
 */
export function shareVersioned(oldData: unknown, newData: unknown): unknown {
    const result = replaceEqualDeep(oldData, newData);
    const version = versionOf(newData);
    if (result !== newData && isObject(result) && version) versions.set(result, version);
    return result;
}
