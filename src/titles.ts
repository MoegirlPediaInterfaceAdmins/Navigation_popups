// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { pg } from "./globals.ts";
import { getValueOf } from "./options.ts";
    class Stringwrapper {
        indexOf(x) {
            return this.toString().indexOf(x);
        }
        toString() {
            return this.value;
        }
        parenSplit(x) {
            return this.toString().parenSplit(x);
        }
        substring(x, y) {
            if (typeof y === "undefined") {
                return this.toString().substring(x);
            }
            return this.toString().substring(x, y);
        }
        split(x) {
            return this.toString().split(x);
        }
        replace(x, y) {
            return this.toString().replace(x, y);
        }
    }
    export class Title extends Stringwrapper {
        value = null;
        anchor = "";
        constructor(val) {
            super();
            this.setUtf(val);
        }
        static fromURL = (h) => new Title().fromURL(h);
        static fromAnchor = (a) => new Title().fromAnchor(a);
        static fromWikiText = (txt) => new Title().fromWikiText(txt);
        toString(omitAnchor) {
            return this.value + (!omitAnchor && this.anchor ? `#${this.anchorString()}` : "");
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
        anchorFromUtf(str) {
            this.anchor = encodeURIComponent(str.split(" ").join("_")).split("%3A").join(":").split("'").join("%27").split("%").join(".");
        }
        decodeNasties(txt) {
            try {
                let ret = decodeURI(this.decodeEscapes(txt));
                ret = ret.replace(/[_ ]*$/, "");
                return ret;
            } catch (e) {
                return txt;
            }
        }
        decodeEscapes = (txt) => {
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
            return safeDecodeURI(this.value);
        }
        toUserName(withNs) {
            if (this.namespaceId() !== pg.nsUserId && this.namespaceId() !== pg.nsUsertalkId) {
                this.value = null;
                return;
            }
            this.value = (withNs ? `${mw.config.get("wgFormattedNamespaces")[pg.nsUserId]}:` : "") + this.stripNamespace().split("/")[0];
        }
        userName(withNs) {
            const t = new Title(this.value);
            t.toUserName(withNs);
            if (t.value) {
                return t;
            }
            return null;
        }
        toTalkPage() {
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
                const n = this.value.indexOf(":");
                if (n < 0) {
                    return 0;
                }
                const namespaceId = mw.config.get("wgNamespaceIds")[this.value.substring(0, n).split(" ").join("_").toLowerCase()];
                if (typeof namespaceId === "undefined") {
                    return 0;
                }
                return namespaceId;
            } catch (e) {
                console.error(e, this);
                return 0;
            }
        }
        talkPage() {
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
        toArticleFromTalkPage() {
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
        articleFromTalkPage() {
            const t = new Title(this.value);
            t.toArticleFromTalkPage();
            if (t.value) {
                return t;
            }
            return null;
        }
        articleFromTalkOrArticle() {
            const t = new Title(this.value);
            if (t.toArticleFromTalkPage()) {
                return t;
            }
            return this;
        }
        isIpUser() {
            return pg.re.ipUser.test(this.userName());
        }
        stripNamespace() {
            const n = this.value.indexOf(":");
            if (n < 0) {
                return this.value;
            }
            const namespaceId = this.namespaceId();
            if (namespaceId === pg.nsMainspaceId) {
                return this.value;
            }
            return this.value.substring(n + 1);
        }
        setUtf(value) {
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
        setUrl(urlfrag) {
            const anch = urlfrag.indexOf("#");
            this.value = safeDecodeURI(urlfrag.substring(0, anch));
            this.anchor = this.value.substring(anch + 1);
        }
        append(x) {
            this.setUtf(this.value + x);
        }
        urlString(_x) {
            let x = _x;
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
        fromURL(_h) {
            let h = _h;
            if (typeof h !== "string") {
                this.value = null;
                return this;
            }
            const splitted = h.split("?");
            splitted[0] = splitted[0].split("&").join("%26");
            h = splitted.join("?");
            const contribs = pg.re.contribs.exec(h);
            if (contribs) {
                if (contribs[1] === "title=") {
                    contribs[3] = contribs[3].split("+").join(" ");
                }
                const u = new Title(contribs[3]);
                this.setUtf(this.decodeNasties(`${mw.config.get("wgFormattedNamespaces")[pg.nsUserId]}:${u.stripNamespace()}`));
                return this;
            }
            const email = pg.re.email.exec(h);
            if (email) {
                this.setUtf(this.decodeNasties(`${mw.config.get("wgFormattedNamespaces")[pg.nsUserId]}:${new Title(email[3]).stripNamespace()}`));
                return this;
            }
            const backlinks = pg.re.backlinks.exec(h);
            if (backlinks) {
                this.setUtf(this.decodeNasties(new Title(backlinks[3])));
                return this;
            }
            const specialdiff = pg.re.specialdiff.exec(h);
            if (specialdiff) {
                this.setUtf(this.decodeNasties(new Title(`${mw.config.get("wgFormattedNamespaces")[pg.nsSpecialId]}:Diff`)));
                return this;
            }
            const m = pg.re.main.exec(h);
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
        fromAnchor(a) {
            if (!a) {
                this.value = null;
                return this;
            }
            return this.fromURL(a.href);
        }
        fromWikiText(_txt) {
            let txt = _txt;
            txt = myDecodeURI(txt);
            this.setUtf(txt);
            return this;
        }
    }
    export const parseParams = (_url) => {
        let url = _url;
        const specialDiff = pg.re.specialdiff.exec(url);
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
        const ret = {};
        if (url.indexOf("?") === -1) {
            return ret;
        }
        url = url.split("#")[0];
        const s = url.split("?").slice(1).join();
        const t = s.split("&");
        for (let i = 0; i < t.length; ++i) {
            const z = t[i].split("=");
            z.push(null);
            ret[z[0]] = z[1];
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
    const myDecodeURI = (str) => {
        let ret;
        try {
            ret = decodeURI(str.toString());
        } catch (summat) {
            return str;
        }
        for (let i = 0; i < pg.misc.decodeExtras.length; ++i) {
            const from = pg.misc.decodeExtras[i].from;
            const to = pg.misc.decodeExtras[i].to;
            ret = ret.split(from).join(to);
        }
        return ret;
    };
    export const safeDecodeURI = (str) => {
        const ret = myDecodeURI(str);
        return ret || str;
    };
    export const isDisambig = (data, article) => {
        if (!getValueOf("popupAllDabsStubs") && article.namespace()) {
            return false;
        }
        return !article.isTalkPage() && pg.re.disambig.test(data);
    };
    export const stubCount = (data, article) => {
        if (!getValueOf("popupAllDabsStubs") && article.namespace()) {
            return false;
        }
        let sectStub = 0;
        let realStub = 0;
        if (pg.re.stub.test(data)) {
            const s = data.parenSplit(pg.re.stub);
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
    export const isValidImageName = (str) => str.indexOf("{") === -1;
    export const isInStrippableNamespace = (article) => article.namespaceId() !== 0;
    export const isInMainNamespace = (article) => article.namespaceId() === 0;
    export const anchorContainsImage = (a) => {
        if (a === null) {
            return false;
        }
        const kids = a.childNodes;
        for (let i = 0; i < kids.length; ++i) {
            if (kids[i].nodeName === "IMG") {
                return true;
            }
        }
        return false;
    };
    export const isPopupLink = (a) => {
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
        if (!pg.re.basenames.test(h)) {
            return false;
        }
        if (!pg.re.urlNoPopup.test(h)) {
            return true;
        }
        return (pg.re.email.test(h) || pg.re.contribs.test(h) || pg.re.backlinks.test(h) || pg.re.specialdiff.test(h)) && h.indexOf("&limit=") === -1;
    };
    const markNopopupSpanLinks = () => {
        if (!getValueOf("popupOnlyArticleLinks")) {
            fixVectorMenuPopups();
        }
        const s = $(".nopopups").toArray();
        for (let i = 0; i < s.length; ++i) {
            const as = s[i].getElementsByTagName("a");
            for (let j = 0; j < as.length; ++j) {
                as[j].inNopopupSpan = true;
            }
        }
        markNopopupSpanLinks.done = true;
    };
    const fixVectorMenuPopups = () => {
        $("div.vectorMenu h3:first a:first, div.vector-menu h3:first a:first, nav.vector-menu h3:first a:first").prop("inNopopupSpan", true);
    };
