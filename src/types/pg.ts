// Core interface for the pg global object (typing effort module 1).
// Domains are shaped from actual usage across the modules; keys that are
// assigned at init time (namespaces.ts / init.ts) are optional. Narrow unions
// plus assertions at read sites are preferred over `any` so that the strict
// type-checked lint rules keep working.

export type AnyRecord = Record<string, any>;

export interface SpecialPageAlias {
    realname: string;
    aliases: string[];
}

export interface CachedPage {
    url: string;
    data?: string;
    lastModified?: string | Date | null;
}

// One popup "structure" definition (original / nostalgia / fancy / …) as
// built by structures.ts: named component renderers plus a layout order.
export interface PopupStructure {
    popupLayout?: () => (string | string[])[];
    popupTitle?: (x: StructureContext) => string;
    popupTopLinks?: (x: StructureContext, shorter?: boolean) => string;
    popupRedirTitle?: (x: StructureContext) => string;
    popupRedirTopLinks?: (x: StructureContext, shorter?: boolean) => string;
    popupOtherLinks?: (x: StructureContext) => string;
    popupImage?: (x: StructureContext) => string;
    popupPreview?: (x: StructureContext) => string;
    popupUserData?: (x: StructureContext) => string;
    popupError?: (x: StructureContext) => string;
    [key: string]: unknown;
}

// Context handed to structure component renderers (a navlink-ish article
// descriptor; kept loose until navlinks.ts is fully typed).
export interface StructureContext {
    a?: unknown;
    article?: unknown;
    hint?: string | null;
    navpop?: Navpopup;
    params?: Record<string, string>;
    [key: string]: unknown;
}

export interface WikiInfo {
    hostname: string;
    lang: string;
    articlePath: string;
    APIPath: string;
    botInterfacePath: string;
    titlebase: string;
    articlebase: string;
    sitebase: string;
    wikibase: string;
    apiwikibase: string;
    // null on wikis that are not Wikimedia sister projects (upstream keeps
    // null here and interpolates it away in non-commons URLs)
    commons: string | null;
    commonsbase: string;
    apicommonsbase: string;
    specialpagealiases: SpecialPageAlias[];
    interwiki: string;
    wikimedia: boolean;
    wikia: boolean;
    isLocal: boolean;
}

export interface CurrentState {
    article?: import("../titles.ts").Title;
    link?: HTMLAnchorElement | null;
    links?: { navpopup?: unknown }[];
    linksHash?: Record<string, unknown>;
}

export interface Pg {
    api: {
        client?: mw.Api;
        userAgent?: string;
    };
    // RegExp store plus a couple of bracket counters kept on the same object
    re: Record<string, RegExp | number>;
    ns: Record<string, number>;
    string: Record<string, string>;
    wiki: WikiInfo;
    user: {
        canReview?: boolean;
        locales?: string[];
        timeZone?: string;
        [key: string]: unknown;
    };
    misc: {
        decodeExtras?: { from: string; to: string }[];
        defaultNavlinkClassname?: string;
        downloadsInProgress?: Record<string, import("../downloader.ts").Downloader>;
        layout?: (string | string[])[];
        redirSpans?: string[];
        [key: string]: unknown;
    };
    option: Record<string, string | number | boolean | null | object | undefined>;
    optionDefault: Record<string, string | number | boolean | null | object | undefined>;
    flag: AnyRecord;
    cache: {
        pages: CachedPage[];
        [key: string]: unknown;
    };
    structures: Record<string, PopupStructure>;
    timer: Record<string, (() => void) | null | unknown>;
    counter: Record<string, number | unknown>;
    current: CurrentState;
    fn: Record<string, (...args: unknown[]) => unknown>;
    endoflist: null;
    // namespace ids and misc scalars assigned at init time
    nsSpecialId?: number;
    nsMainspaceId?: number;
    nsImageId?: number;
    nsUserId?: number;
    nsUsertalkId?: number;
    nsCategoryId?: number;
    nsTemplateId?: number;
    idNumber?: number;
    escapeQuotesHTML?: (text: string) => string;
    unescapeQuotesHTML?: (html: string) => string;
    [key: string]: unknown;
}
