import { log, pg } from "../globals.ts";
import { setPopupHTML, setPopupTipsAndHTML } from "./htmloutput.ts";
import { Insta, wiki2html } from "./livepreview.ts";
import type { Navpopup } from "./navpopup.ts";
import { getValueOf } from "./options.ts";
import { popupString } from "./strings.ts";
import { Title } from "./titles.ts";
import { assume, isRegExp, isString, literalizeRegex } from "./tools.ts";
export class Previewmaker {
    maxCharacters = Number(getValueOf("popupMaxPreviewCharacters"));
    maxSentences = Number(getValueOf("popupMaxPreviewSentences"));
    originalData!: string;
    // a Title sneaks in here via APIsharedImagePagePreviewHTML (upstream
    // passes the article where a URL belongs); it stringifies fine
    baseUrl!: string | Title;
    owner?: Navpopup;
    data!: string;
    html?: string;
    fullLength = 0;
    constructor(wikiText: string, baseUrl: string | Title, owner?: Navpopup) {
        this.originalData = wikiText;
        this.baseUrl = baseUrl;
        this.owner = owner;
        this.setData();
    }
    setData() {
        const maxSize = Math.max(1e4, 2 * this.maxCharacters);
        this.data = this.originalData.substring(0, maxSize);
    }
    killComments() {
        this.data = this.data.replace(/^<!--[^$]*?-->\n|\n<!--[^$]*?-->(?=\n)|<!--[^$]*?-->/g, "");
    }
    killDivs() {
        this.data = this.data.replace(/< *div[^>]* *>[\s\S]*?< *\/ *div *>/ig, "");
    }
    killGalleries() {
        this.data = this.data.replace(/< *gallery[^>]* *>[\s\S]*?< *\/ *gallery *>/ig, "");
    }
    kill(opening: string | RegExp, closing: string | RegExp, subopening?: string | RegExp, subclosing?: string | RegExp, repl?: string) {
        let oldk = this.data;
        let k = this.killStuff(this.data, opening, closing, subopening, subclosing, repl);
        while (k.length < oldk.length) {
            oldk = k;
            k = this.killStuff(k, opening, closing, subopening, subclosing, repl);
        }
        this.data = k;
    }
    killStuff(_txt: string, opening: string | RegExp, closing: string | RegExp, subopening?: string | RegExp, subclosing?: string | RegExp, repl?: string): string {
        let txt = _txt;
        const op = this.makeRegexp(opening);
        const cl = this.makeRegexp(closing, "^");
        const sb = subopening ? this.makeRegexp(subopening, "^") : null;
        const sc = subclosing ? this.makeRegexp(subclosing, "^") : cl;

        if (!op.test(txt)) {
            return txt;
        }
        const opResult = assume(op.exec(txt));
        const ret = txt.substring(0, opResult.index);
        txt = txt.substring(opResult.index + opResult[0].length);
        let depth = 1;
        while (txt.length > 0) {
            let removal = 0;
            if (depth === 1 && cl.test(txt)) {
                depth--;
                removal = assume(cl.exec(txt))[0].length;
            } else if (depth > 1 && sc.test(txt)) {
                depth--;
                removal = assume(sc.exec(txt))[0].length;
            } else if (sb?.test(txt)) {
                depth++;
                removal = assume(sb.exec(txt))[0].length;
            }
            if (!removal) {
                removal = 1;
            }
            txt = txt.substring(removal);
            if (depth === 0) {
                break;
            }
        }
        return ret + (repl ?? "") + txt;
    }
    makeRegexp = (x: string | RegExp, _prefix?: string, _suffix?: string): RegExp => {
        const prefix = _prefix ?? "";
        const suffix = _suffix ?? "";
        let reStr = "";
        let flags = "";
        if (isString(x)) {
            reStr = prefix + literalizeRegex(x) + suffix;
        } else if (isRegExp(x)) {
            let s = x.toString().substring(1);
            const sp = s.split("/");
            flags = sp[sp.length - 1];
            sp[sp.length - 1] = "";
            s = sp.join("/");
            s = s.substring(0, s.length - 1);
            reStr = prefix + s + suffix;
        } else {
            log("makeRegexp failed");
        }
        log(`makeRegexp: got reStr=${reStr}, flags=${flags}`);
        return RegExp(reStr, flags);
    };
    killBoxTemplates() {
        this.kill(/[{][{][^{}\s|]*?(float|box)[_ ](begin|start)/i, /[}][}]\s*/, "{{");
        this.kill(/[{][{][^{}\s|]*?(infobox|elementbox|frame)[_ ]/i, /[}][}]\s*/, "{{");
    }
    killTemplates() {
        this.kill("{{", "}}", "{", "}", " ");
    }
    killTables() {
        this.kill("{|", /[|]}\s*/, "{|");
        this.kill(/<table.*?>/i, /<\/table.*?>/i, /<table.*?>/i);
        this.data = this.data.replace(RegExp("^[|].*$", "mg"), "");
    }
    killImages() {
        const forbiddenNamespaceAliases: string[] = [];
        $.each(mw.config.get("wgNamespaceIds"), (_localizedNamespaceLc: string, _namespaceId: number) => {
            if (_namespaceId !== pg.nsImageId && _namespaceId !== pg.nsCategoryId) {
                return;
            }
            forbiddenNamespaceAliases.push(_localizedNamespaceLc.split(" ").join("[ _]"));
        });
        this.kill(RegExp(`[[][[]\\s*(${forbiddenNamespaceAliases.join("|")})\\s*:`, "i"), /\]\]\s*/, "[", "]");
    }
    killHTML() {
        this.kill(/<ref\b[^/>]*?>/i, /<\/ref>/i);
        this.data = this.data.replace(/(^|\n) *<.*/g, "\n");
        const splitted = this.data.parenSplit(/(<[\w\W]*?(?:>|$|(?=<)))/);
        const len = splitted.length;
        for (let i = 1; i < len; i = i + 2) {
            switch (splitted[i]) {
                case "<nowiki>":
                case "</nowiki>":
                case "<blockquote>":
                case "</blockquote>":
                    break;
                default:
                    splitted[i] = "";
            }
        }
        this.data = splitted.join("");
    }
    killChunks() {
        const italicChunkRegex = /((^|\n)\s*:*\s*''[^']([^']|'''|'[^']){20}(.|\n[^\n])*''[.!?\s]*\n)+/g;
        this.data = this.data.replace(italicChunkRegex, "\n");
    }
    mopup() {
        this.data = this.data.replace(/^-{4,}/mg, "");
        this.data = this.data.replace(/(^|\n) *:[^\n]*/g, "");
        this.data = this.data.replace(/^__[A-Z_]*__ *$/img, "");
    }
    firstBit() {
        let d: string | string[] = this.data;
        if (getValueOf("popupPreviewCutHeadings")) {
            this.data = this.data.replace(/\s*(==+[^=]*==+)\s*/g, "\n\n$1 ");
            this.data = this.data.replace(/([:;]) *\n{2,}/g, "$1\n");
            this.data = this.data.replace(/^[\s\n]*/, "");
            const stuff = /^([^\n]|\n[^\n\s])*/.exec(this.data);
            if (stuff) {
                d = stuff[0];
            }
            if (!getValueOf("popupPreviewFirstParOnly")) {
                d = this.data;
            }
            d = d.replace(/(==+[^=]*==+)\s*/g, "$1\n\n");
        }
        d = d.parenSplit(/([!?.]+["']*\s)/g);
        d[0] = d[0].replace(/^\s*/, "");
        const notSentenceEnds = /([^.][a-z][.] *[a-z]|etc|sic|Dr|Mr|Mrs|Ms|St|no|op|cit|\[[^\]]*|\s[A-Zvclm])$/i;
        d = this.fixSentenceEnds(d, notSentenceEnds);
        this.fullLength = d.join("").length;
        let n = this.maxSentences;
        let dd: string;
        do {
            dd = this.firstSentences(d, n);
            --n;
        } while (dd.length > this.maxCharacters && n !== 0);
        this.data = dd;
    }
    fixSentenceEnds(strs: string[], reg: RegExp): string[] {
        for (let i = 0; i < strs.length - 2; ++i) {
            if (reg.test(strs[i])) {
                const a: string[] = [];
                for (let j = 0; j < strs.length; ++j) {
                    if (j < i) {
                        a[j] = strs[j];
                    }
                    if (j === i) {
                        a[i] = strs[i] + strs[i + 1] + strs[i + 2];
                    }
                    if (j > i + 2) {
                        a[j - 2] = strs[j];
                    }
                }
                return this.fixSentenceEnds(a, reg);
            }
        }
        return strs;
    }
    firstSentences = (strs: string[], howmany: number): string => {
        const t = strs.slice(0, 2 * howmany);
        return t.join("");
    };
    killBadWhitespace() {
        this.data = this.data.replace(/^ *'+ *$/gm, "");
    }
    makePreview() {
        if (this.owner?.article?.namespaceId() !== pg.nsTemplateId && this.owner?.article?.namespaceId() !== pg.nsImageId) {
            this.killComments();
            this.killDivs();
            this.killGalleries();
            this.killBoxTemplates();
            if (getValueOf("popupPreviewKillTemplates")) {
                this.killTemplates();
            } else {
                this.killMultilineTemplates();
            }
            this.killTables();
            this.killImages();
            this.killHTML();
            this.killChunks();
            this.mopup();
            this.firstBit();
            this.killBadWhitespace();
        } else {
            this.killHTML();
        }
        this.html = wiki2html(this.data, this.baseUrl as string);
        this.fixHTML();
        this.stripLongTemplates();
    }
    esWiki2HtmlPart = (data: string): string => {
        const reLinks = /(?:\[\[([^|\]]*)(?:\|([^|\]]*))*]]([a-z]*))/gi;
        reLinks.lastIndex = 0;
        let result = "";
        let postfixIndex = 0;
        let match = reLinks.exec(data);
        while (match) {
            result += `${pg.escapeQuotesHTML?.(data.substring(postfixIndex, match.index)) ?? ""}<a href="${Insta.conf.paths.articles}${pg.escapeQuotesHTML?.(match[1]) ?? ""}">${pg.escapeQuotesHTML?.((match[2] ? match[2] : match[1]) + match[3]) ?? ""}</a>`;
            postfixIndex = reLinks.lastIndex;
            match = reLinks.exec(data);
        }
        result += pg.escapeQuotesHTML?.(data.substring(postfixIndex)) ?? "";
        return result;
    };
    editSummaryPreview(): string {
        const reAes = /\/\* *(.*?) *\*\//g;
        reAes.lastIndex = 0;
        const match = reAes.exec(this.data);
        if (match) {
            const prefix = this.data.substring(0, match.index - 1);
            const section = match[1];
            const postfix = this.data.substring(reAes.lastIndex);
            let start = "<span class='autocomment'>";
            let end = "</span>";
            if (prefix.length > 0) {
                start = `${this.esWiki2HtmlPart(prefix)} ${start}- `;
            }
            if (postfix.length > 0) {
                end = `: ${end}${this.esWiki2HtmlPart(postfix)}`;
            }
            const t = new Title().fromURL(this.baseUrl);
            t.anchorFromUtf(section);
            const sectionLink = `${Insta.conf.paths.articles + (pg.escapeQuotesHTML?.(t.toString(true)) ?? "")}#${pg.escapeQuotesHTML?.(t.anchor) ?? ""}`;
            return `${start}<a href="${sectionLink}">&rarr;</a> ${pg.escapeQuotesHTML?.(section) ?? ""}${end}`;
        }
        return this.esWiki2HtmlPart(this.data);
    }
    fixHTML() {
        if (!this.html) {
            return;
        }
        let ret = this.html;
        ret = ret.replace(RegExp(`(<a href="${pg.wiki.articlePath}/[^"]*)[?](.*?")`, "g"), "$1%3F$2");
        ret = ret.replace(RegExp(`(<a href='${pg.wiki.articlePath}/[^']*)[?](.*?')`, "g"), "$1%3F$2");
        this.html = ret;
    }
    showPreview() {
        this.makePreview();
        if (typeof this.html !== typeof "") {
            return;
        }
        if (RegExp("^\\s*$").test(this.html ?? "")) {
            return;
        }
        setPopupHTML("<hr />", "popupPrePreviewSep", this.owner?.idNumber);
        setPopupTipsAndHTML(this.html, "popupPreview", this.owner?.idNumber, {
            owner: this.owner,
        });
        const more = this.fullLength > this.data.length ? this.moreLink() : "";
        setPopupHTML(more, "popupPreviewMore", this.owner?.idNumber);
    }
    moreLink(): HTMLAnchorElement {
        const a = document.createElement("a");
        a.className = "popupMoreLink";
        a.innerHTML = popupString("more...");
        a.onclick = () => {
            this.maxCharacters += 2e3;
            this.maxSentences += 20;
            this.setData();
            this.showPreview();
        };
        return a;
    }
    stripLongTemplates() {
        this.html = (this.html ?? "").replace(/^.{0,1000}[{][{][^}]*?(<(p|br)( \/)?>\s*){2,}([^{}]*?[}][}])?/ig, "");
        this.html = (this.html ?? "").split("\n").join(" ");
        this.html = (this.html ?? "").replace(/[{][{][^}]*<pre>[^}]*[}][}]/ig, "");
    }
    killMultilineTemplates() {
        this.kill("{{{", "}}}");
        this.kill(/\s*[{][{][^{}]*\n/, "}}", "{{");
    }
}
