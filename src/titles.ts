import { pg } from "./globals.ts";
import { getValueOf } from "./options.ts";
import { assume } from "./tools.ts";
class Stringwrapper {
    value: string | null = null;
    indexOf(x: string) {
        return this.toString().indexOf(x);
    }
    toString() {
        // null-valued wrappers are a transient upstream state; the null
        // flows through untouched at runtime
        return this.value as unknown as string;
    }
    parenSplit(x: RegExp | string) {
        return this.toString().parenSplit(x);
    }
    substring(x: number, y?: number) {
        if (typeof y === "undefined") {
            return this.toString().substring(x);
        }
        return this.toString().substring(x, y);
    }
    split(x: string) {
        return this.toString().split(x);
    }
    replace(x: RegExp, y: string) {
        return this.toString().replace(x, y);
    }
}
export class Title extends Stringwrapper {
    anchor = "";
    // legacy marker assigned (and never read) by setUtf
    ns?: null;
    // revision anchor state attached by actions.ts loadPreview
    oldid?: string | null;
    constructor(val?: string | Stringwrapper | null) {
        super();
        this.setUtf(val);
    }
    static fromURL = (h: string) => new Title().fromURL(h);
    static fromAnchor = (a: HTMLAnchorElement | null) => new Title().fromAnchor(a);
    static fromWikiText = (txt: string) => new Title().fromWikiText(txt);
    override toString(omitAnchor?: unknown) {
        return String(this.value) + (!omitAnchor && this.anchor ? `#${this.anchorString()}` : "");
    }
    anchorString() {
        if (!this.anchor) {
            return "";
        }
        const split = this.anchor.parenSplit(/((?:[.][0-9A-F]{2})+)/);
        const len = split.length;
        let value;
        for (let j = 1; j < len; j += 2) {
            value = split[j].split(".").join("%");
            try {
                value = decodeURIComponent(value);
            } catch { }
            split[j] = value.split("_").join(" ");
        }
        return split.join("");
    }
    urlAnchor() {
        const split = this.anchor.parenSplit("/((?:[%][0-9A-F]{2})+)/");
        const len = split.length;
        for (let j = 1; j < len; j += 2) {
            split[j] = split[j].split("%").join(".");
        }
        return split.join("");
    }
    anchorFromUtf(str: string) {
        this.anchor = encodeURIComponent(str.split(" ").join("_")).split("%3A").join(":").split("'").join("%27").split("%").join(".");
    }
    decodeNasties(txt: string | Stringwrapper) {
        try {
            let ret = decodeURI(this.decodeEscapes(txt));
            ret = ret.replace(/[_ ]*$/, "");
            return ret;
        } catch {
            return txt;
        }
    }
    decodeEscapes = (txt: string | Stringwrapper) => {
        const split = txt.parenSplit(/((?:[%][0-9A-Fa-f]{2})+)/);
        const len = split.length;
        if (len === 1) {
            return split[0].replace(/%(?![0-9a-fA-F][0-9a-fA-F])/g, "%25");
        }
        for (let i = 1; i < len; i = i + 2) {
            split[i] = decodeURIComponent(split[i]);
        }
        return split.join("");
    };
    hintValue() {
        if (!this.value) {
            return "";
        }
        return safeDecodeURI(this.value) as string;
    }
    toUserName(withNs?: boolean) {
        if (this.namespaceId() !== pg.nsUserId && this.namespaceId() !== pg.nsUsertalkId) {
            this.value = null;
            return;
        }
        this.value = (withNs ? `${mw.config.get("wgFormattedNamespaces")[pg.nsUserId ?? -1]}:` : "") + this.stripNamespace().split("/")[0];
    }
    userName(withNs?: boolean): Title | null {
        const t = new Title(this.value);
        t.toUserName(withNs);
        if (t.value) {
            return t;
        }
        return null;
    }
    toTalkPage(): string | null {
        if (this.value === null) {
            return null;
        }
        const namespaceId = this.namespaceId();
        if (namespaceId >= 0 && namespaceId % 2 === 0) {
            const localizedNamespace = mw.config.get("wgFormattedNamespaces")[namespaceId + 1];
            if (typeof localizedNamespace !== "undefined") {
                if (localizedNamespace === "") {
                    this.value = this.stripNamespace();
                } else {
                    this.value = `${localizedNamespace.split(" ").join("_")}:${this.stripNamespace()}`;
                }
                return this.value;
            }
        }
        this.value = null;
        return null;
    }
    namespace() {
        return mw.config.get("wgFormattedNamespaces")[this.namespaceId()];
    }
    namespaceId() {
        try {
            const n = assume(this.value).indexOf(":");
            if (n < 0) {
                return 0;
            }
            const namespaceId = mw.config.get("wgNamespaceIds")[assume(this.value).substring(0, n).split(" ").join("_").toLowerCase()];
            if (typeof namespaceId === "undefined") {
                return 0;
            }
            return namespaceId;
        } catch (e) {
            console.error(e, this);
            return 0;
        }
    }
    talkPage(): Title | null {
        const t = new Title(this.value);
        t.toTalkPage();
        if (t.value) {
            return t;
        }
        return null;
    }
    isTalkPage() {
        if (this.talkPage() === null) {
            return true;
        }
        return false;
    }
    toArticleFromTalkPage(): string | null {
        if (this.value === null) {
            return null;
        }
        const namespaceId = this.namespaceId();
        if (namespaceId >= 0 && namespaceId % 2 === 1) {
            const localizedNamespace = mw.config.get("wgFormattedNamespaces")[namespaceId - 1];
            if (typeof localizedNamespace !== "undefined") {
                if (localizedNamespace === "") {
                    this.value = this.stripNamespace();
                } else {
                    this.value = `${localizedNamespace.split(" ").join("_")}:${this.stripNamespace()}`;
                }
                return this.value;
            }
        }
        this.value = null;
        return null;
    }
    articleFromTalkPage(): Title | null {
        const t = new Title(this.value);
        t.toArticleFromTalkPage();
        if (t.value) {
            return t;
        }
        return null;
    }
    articleFromTalkOrArticle(): Title {
        const t = new Title(this.value);
        if (t.toArticleFromTalkPage()) {
            return t;
        }
        return this;
    }
    isIpUser() {
        return (pg.re.ipUser as RegExp).test(String(this.userName()));
    }
    stripNamespace() {
        const n = assume(this.value).indexOf(":");
        if (n < 0) {
            return assume(this.value);
        }
        const namespaceId = this.namespaceId();
        if (namespaceId === pg.nsMainspaceId) {
            return assume(this.value);
        }
        return assume(this.value).substring(n + 1);
    }
    setUtf(value: string | Stringwrapper | null | undefined) {
        if (!value) {
            this.value = "";
            return;
        }
        const anch = value.indexOf("#");
        if (anch < 0) {
            this.value = value.split("_").join(" ");
            this.anchor = "";
            return;
        }
        this.value = value.substring(0, anch).split("_").join(" ");
        this.anchor = value.substring(anch + 1);
        this.ns = null;
    }
    setUrl(urlfrag: string) {
        const anch = urlfrag.indexOf("#");
        this.value = safeDecodeURI(urlfrag.substring(0, anch)) as string;
        this.anchor = this.value.substring(anch + 1);
    }
    append(x: string) {
        this.setUtf(String(this.value) + x);
    }
    urlString(_x?: unknown) {
        let x = _x as { omitAnchor?: boolean; keepSpaces?: boolean };
        if (!x) {
            x = {};
        }
        let v = this.toString(true);
        if (!x.omitAnchor && this.anchor) {
            v += `#${this.urlAnchor()}`;
        }
        if (!x.keepSpaces) {
            v = v.split(" ").join("_");
        }
        return encodeURI(v).split("&").join("%26").split("?").join("%3F").split("+").join("%2B");
    }
    removeAnchor() {
        return new Title(this.toString(true));
    }
    toUrl() {
        return pg.wiki.titlebase + this.urlString();
    }
    fromURL(_h?: unknown) {
        if (typeof _h !== "string") {
            this.value = null;
            return this;
        }
        let h: string = _h;
        const splitted = h.split("?");
        splitted[0] = splitted[0].split("&").join("%26");
        h = splitted.join("?");
        const contribs = (pg.re.contribs as RegExp).exec(h);
        if (contribs) {
            if (contribs[1] === "title=") {
                contribs[3] = contribs[3].split("+").join(" ");
            }
            const u = new Title(contribs[3]);
            this.setUtf(this.decodeNasties(`${mw.config.get("wgFormattedNamespaces")[pg.nsUserId ?? -1]}:${u.stripNamespace()}`));
            return this;
        }
        const email = (pg.re.email as RegExp).exec(h);
        if (email) {
            this.setUtf(this.decodeNasties(`${mw.config.get("wgFormattedNamespaces")[pg.nsUserId ?? -1]}:${new Title(email[3]).stripNamespace()}`));
            return this;
        }
        const backlinks = (pg.re.backlinks as RegExp).exec(h);
        if (backlinks) {
            this.setUtf(this.decodeNasties(new Title(backlinks[3])));
            return this;
        }
        const specialdiff = (pg.re.specialdiff as RegExp).exec(h);
        if (specialdiff) {
            this.setUtf(this.decodeNasties(new Title(`${mw.config.get("wgFormattedNamespaces")[pg.nsSpecialId ?? -1]}:Diff`)));
            return this;
        }
        const m = (pg.re.main as RegExp).exec(h);
        if (m === null) {
            this.value = null;
        } else {
            const fromBotInterface = /[?](.+[&])?title=/.test(h);
            if (fromBotInterface) {
                m[2] = m[2].split("+").join("_");
            }
            const extracted = m[2] + (m[3] ? `#${m[3]}` : "");
            if (pg.flag.isSafari && /%25[0-9A-Fa-f]{2}/.test(extracted)) {
                this.setUtf(decodeURIComponent(unescape(extracted)));
            } else {
                this.setUtf(this.decodeNasties(extracted));
            }
        }
        return this;
    }
    fromAnchor(a: HTMLAnchorElement | null) {
        if (!a) {
            this.value = null;
            return this;
        }
        return this.fromURL(a.href);
    }
    fromWikiText(_txt: string | Stringwrapper) {
        let txt = _txt;
        txt = myDecodeURI(txt);
        this.setUtf(txt);
        return this;
    }
}
export const parseParams = (_url: string): Record<string, string | null> => {
    let url = _url;
    const specialDiff = (pg.re.specialdiff as RegExp).exec(url);
    if (specialDiff) {
        const split = specialDiff[1].split("/");
        if (split.length === 1) {
            return {
                oldid: split[0],
                diff: "prev",
            };
        } else if (split.length === 2) {
            return {
                oldid: split[0],
                diff: split[1],
            };
        }
    }
    const ret: Record<string, string | null> = {};
    if (!url.includes("?")) {
        return ret;
    }
    url = url.split("#")[0];
    const s = url.split("?").slice(1).join();
    const t = s.split("&");
    for (const pair of t) {
        const z: (string | null)[] = pair.split("=");
        z.push(null);
        ret[assume(z[0])] = z[1];
    }
    if (ret.diff && typeof ret.oldid === "undefined") {
        ret.oldid = "prev";
    }
    if (ret.oldid && (ret.oldid === "prev" || ret.oldid === "next" || ret.oldid === "cur")) {
        const helper = ret.diff;
        ret.diff = ret.oldid;
        ret.oldid = helper;
    }
    return ret;
};
const myDecodeURI = (str: string | Stringwrapper): string | Stringwrapper => {
    let ret;
    try {
        ret = decodeURI(str.toString());
    } catch {
        return str;
    }
    const extras = pg.misc.decodeExtras;
    for (let i = 0; i < (extras?.length ?? 0); ++i) {
        const from = assume(extras)[i].from;
        const to = assume(extras)[i].to;
        ret = ret.split(from).join(to);
    }
    return ret;
};
export const safeDecodeURI = (str: string | Stringwrapper): string | Stringwrapper => {
    const ret = myDecodeURI(str);
    return ret || str;
};
export const isDisambig = (data: string, article: Title) => {
    if (!getValueOf("popupAllDabsStubs") && article.namespace()) {
        return false;
    }
    return !article.isTalkPage() && (pg.re.disambig as RegExp).test(data);
};
export const stubCount = (data: string, article: Title): false | { real: number; sect: number } => {
    if (!getValueOf("popupAllDabsStubs") && article.namespace()) {
        return false;
    }
    let sectStub = 0;
    let realStub = 0;
    if ((pg.re.stub as RegExp).test(data)) {
        const s = data.parenSplit(pg.re.stub as RegExp);
        for (let i = 1; i < s.length; i = i + 2) {
            if (s[i]) {
                ++sectStub;
            } else {
                ++realStub;
            }
        }
    }
    return {
        real: realStub,
        sect: sectStub,
    };
};
export const isValidImageName = (str: string | Stringwrapper) => str.indexOf("{") === -1;
export const isInStrippableNamespace = (article: Title) => article.namespaceId() !== 0;
export const isInMainNamespace = (article: Title) => article.namespaceId() === 0;
export const anchorContainsImage = (a: HTMLAnchorElement | null) => {
    if (a === null) {
        return false;
    }
    const kids = a.childNodes;
    for (const kid of kids) {
        if (kid.nodeName === "IMG") {
            return true;
        }
    }
    return false;
};
export const isPopupLink = (a: HTMLAnchorElement) => {
    if (!markNopopupSpanLinks.done) {
        markNopopupSpanLinks();
    }
    if (a.inNopopupSpan) {
        return false;
    }
    if (a.onmousedown || a.getAttribute("nopopup")) {
        return false;
    }
    const h = a.href;
    if (h === `${document.location.href}#`) {
        return false;
    }
    if (!(pg.re.basenames as RegExp).test(h)) {
        return false;
    }
    if (!(pg.re.urlNoPopup as RegExp).test(h)) {
        return true;
    }
    return ((pg.re.email as RegExp).test(h) || (pg.re.contribs as RegExp).test(h) || (pg.re.backlinks as RegExp).test(h) || (pg.re.specialdiff as RegExp).test(h)) && !h.includes("&limit=");
};
const markNopopupSpanLinks: (() => void) & { done?: boolean } = () => {
    if (!getValueOf("popupOnlyArticleLinks")) {
        fixVectorMenuPopups();
    }
    const s = $(".nopopups").toArray();
    for (const container of s) {
        const as = container.getElementsByTagName("a");
        for (const a of as) {
            a.inNopopupSpan = true;
        }
    }
    markNopopupSpanLinks.done = true;
};
const fixVectorMenuPopups = () => {
    $("div.vectorMenu h3:first a:first, div.vector-menu h3:first a:first, nav.vector-menu h3:first a:first").prop("inNopopupSpan", true);
};
