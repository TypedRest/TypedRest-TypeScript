import { Link } from ".";

/**
 * Extracts links from responses.
 */
export interface LinkExtractor {
    /**
     * Extracts links from the `response`.
     */
    getLinks(response: Response): Promise<Link[]>;
}
