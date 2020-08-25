/**
 * Represents a link to another resource.
 */
export class Link {
    /**
     * Creates a new link.
     * @param rel The relation type of the link.
     * @param href The href/target of the link.
     * @param title The title of the link.
     * @param templated Indicates whether the link is an URI Template (RFC 6570).
     */
    constructor(public rel: string, public href: string, public title?: string, public templated: boolean = false) { }
}
