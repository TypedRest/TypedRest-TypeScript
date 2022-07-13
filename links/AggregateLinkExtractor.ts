import { Link } from "./Link";
import { LinkExtractor } from "./LinkExtractor";

/**
 * Combines the results of multiple {@link LinkExtractor}s.
 */
export class AggregateLinkExtractor implements LinkExtractor {
    private extractors: LinkExtractor[];

    /**
     * Creates a new aggregate link extractor.
     * @param extractors The link extractors to aggregate.
     */
    constructor(...extractors: LinkExtractor[]) {
        this.extractors = extractors;
    }

    /**
     * @inheritdoc
     */
    async getLinks(response: Response) {
        let result: Link[] = [];
        for (const extractor of this.extractors) {
            result = result.concat(await extractor.getLinks(response));
        }
        return result;
    }
}
