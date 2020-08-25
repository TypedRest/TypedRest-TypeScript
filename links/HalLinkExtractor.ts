import { Link, LinkExtractor } from ".";
import { HttpHeader } from "../http";

/**
 * Extracts links from JSON bodies according to the Hypertext Application Language (HAL) specification.
 */
export class HalLinkExtractor implements LinkExtractor {
    /**
     * @inheritdoc
     */
    async getLinks(response: Response): Promise<Link[]> {
        switch (response.headers.get(HttpHeader.ContentType)) {
            case "application/hal+json":
                return this.parseJsonBody(await response.clone().json());
            default:
                return [];
        }
    }

    private parseJsonBody(body: any): Link[] {
        const links: Link[] = [];

        const linkContainer: { [key: string]: any; } = body._linkContainer;
        if (linkContainer) {
            for (const rel in linkContainer) {
                if (Array.isArray(linkContainer[rel])) {
                    for (const link of linkContainer[rel]) {
                        links.push(this.parseLink(rel, link));
                    }
                } else {
                    links.push(this.parseLink(rel, linkContainer[rel]));
                }
            }
        }

        return links;
    }

    private parseLink(rel: string, obj: any): Link {
        if (!obj.href)
            throw new Error("The link header is lacking the mandatory 'href' field.");
        return new Link(rel, obj.href, obj.title, obj.templated ? true : false);
    }
}
