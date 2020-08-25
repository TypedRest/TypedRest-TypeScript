import { Link, LinkExtractor } from ".";
import { HttpHeader } from "../http";

/**
 * Extracts links from HTTP headers.
 */
export class HeaderLinkExtractor implements LinkExtractor {
    /**
     * @inheritdoc
     */
    async getLinks(response: Response): Promise<Link[]> {
        return response.headers.get(HttpHeader.Link)
            ?.match(/<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g)
            ?.map(value => this.parseLink(value))
            ?? [];
    }


    private parseLink(value: string): Link {
        const split = value.split(">");
        const href = split[0].substring(1);
        let rel: string | undefined;
        let title: string | undefined;
        let templated = false;

        split[1].match(/[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g)?.forEach(param => {
            const paramSplit = param.split("=");
            if (paramSplit[0] === "rel")
                rel = paramSplit[1];
            else if (paramSplit[0] === "title")
                title = paramSplit[1];
            else if (paramSplit[0] === "templated" && paramSplit[1])
                templated = true;
        });

        if (!href)
            throw new Error("The link header is lacking the mandatory 'href' field.");
        if (!rel)
            throw new Error("The link header is lacking the mandatory 'rel' field.");

        return new Link(rel, href, title, templated);
    }
}
