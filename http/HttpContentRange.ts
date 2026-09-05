import { HttpHeader } from "./HttpHeader";

/**
 * Describes which subset of a set of elements a response contains.
 */
export class HttpContentRange {
    /**
     * Creates a new content range.
     * @param unit The unit the range is expressed in, e.g. `elements`.
     * @param from The index at which the data starts.
     * @param to The index at which the data stops.
     * @param length The total number of elements available on the server; `undefined` if unknown.
     */
    constructor(
        public readonly unit: string,
        public readonly from?: number,
        public readonly to?: number,
        public readonly length?: number) {
    }

    private static readonly pattern = /^(\w+) (?:(\d+)-(\d+)|\*)\/(\d+|\*)$/;

    /**
     * Extracts the content range from a `Response`.
     * @returns The content range; `undefined` if the response has no (valid) {@link HttpHeader.ContentRange} header.
     */
    static from(response: Response): HttpContentRange | undefined {
        const header = response.headers.get(HttpHeader.ContentRange);
        if (!header) return undefined;

        const match = HttpContentRange.pattern.exec(header.trim());
        if (!match) return undefined;

        const [, unit, from, to, length] = match;
        return new HttpContentRange(
            unit,
            from === undefined ? undefined : parseInt(from),
            to === undefined ? undefined : parseInt(to),
            length === "*" ? undefined : parseInt(length));
    }
}
