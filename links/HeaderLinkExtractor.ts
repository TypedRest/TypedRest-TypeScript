import { Link } from "./Link";
import { LinkExtractor } from "./LinkExtractor";
import { HttpHeader } from "../http";

/**
 * Extracts links from HTTP headers.
 */
export class HeaderLinkExtractor implements LinkExtractor {
    /**
     * @inheritDoc
     */
    async getLinks(response: Response) {
        return response.headers.get(HttpHeader.Link)
            ?.match(/<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g)
            ?.map(value => this.parseLink(value))
            ?? [];
    }

    private parseLink(value: string) {
        const split = this.split(value, ">");
        const href = split.left.substring(1);
        let rel: string | undefined;
        let title: string | undefined;
        let templated = false;

        split.right.match(/[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g)?.forEach(param => {
            const paramSplit = this.split(param, "=");
            if (paramSplit.left === "rel") {
                rel = paramSplit.right;
            } else if (paramSplit.left === "title") {
                title = paramSplit.right;
                if (title.startsWith('"') && title.endsWith('"')) {
                    title = title.substring(1, title.length - 1);
                }
            } else if (paramSplit.left === "templated" && paramSplit.right === "true") {
                templated = true;
            }
        });

        if (!rel) throw new Error("The link header is lacking the mandatory 'rel' field.");
        return new Link(rel, href, title, templated);
    }

    private split(str: string, separator: string): { left: string, right: string } {
        const result = str.split(separator, 2);
        return (result.length === 2)
            ? {
                left: result[0],
                right: result[1] + str.substr(result.join(separator).length)
            }
            : {
                left: result[0],
                right: ''
            };
    }
}
