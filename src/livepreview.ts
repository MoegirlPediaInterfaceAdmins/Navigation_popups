import { pg } from "./globals.ts";
import { assume } from "./tools.ts";
interface InstaConfUser {
    name?: string;
    signature?: string;
}
interface InstaConf {
    baseUrl?: string;
    user: InstaConfUser;
    wiki: {
        lang: string;
        interwiki: string;
        default_thumb_width: number;
    };
    paths: {
        articles: string;
        math: string;
        images: string;
        images_fallback: string;
    };
    locale: {
        user: string;
        image: string;
        category: string;
        months: string[];
    };
}
interface InstaObject {
    conf: InstaConf;
    BLOCK_IMAGE: RegExp;
    dump: (this: InstaObject, _from: string | HTMLTextAreaElement, _to: string | HTMLTextAreaElement) => void;
    convert: (wiki: string | string[]) => string;
}
export const Insta: InstaObject = {} as InstaObject;
export const setupLivePreview = () => {
    Insta.conf = {
        baseUrl: "",
        user: {},
        wiki: {
            lang: pg.wiki.lang,
            interwiki: pg.wiki.interwiki,
            default_thumb_width: 180,
        },
        paths: {
            articles: `${pg.wiki.articlePath}/`,
            math: "/math/",
            images: "//upload.wikimedia.org/wikipedia/en/",
            images_fallback: "//upload.wikimedia.org/wikipedia/commons/",
        },
        locale: {
            user: mw.config.get("wgFormattedNamespaces")[pg.nsUserId ?? -1],
            image: mw.config.get("wgFormattedNamespaces")[pg.nsImageId ?? -1],
            category: mw.config.get("wgFormattedNamespaces")[pg.nsCategoryId ?? -1],
            months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        },
    };
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string is a meaningful value here; the || branch is deliberate upstream behavior
    Insta.conf.user.name ||= "Wikipedian";
    Insta.conf.user.signature = `[[${Insta.conf.locale.user}:${Insta.conf.user.name}|${Insta.conf.user.name}]]`;
    Insta.BLOCK_IMAGE = new RegExp(`^\\[\\[(?:File|Image|${Insta.conf.locale.image}):.*?\\|.*?(?:frame|thumbnail|thumb|none|right|left|center)`, "i");
};
Insta.dump = function (_from: string | HTMLTextAreaElement, _to: string | HTMLTextAreaElement) {
    const from: HTMLTextAreaElement | null = typeof _from === "string" ? document.getElementById(_from) as HTMLTextAreaElement | null : _from;
    const to: HTMLTextAreaElement | null = typeof _to === "string" ? document.getElementById(_to) as HTMLTextAreaElement | null : _to;
    if (to && from) {
        to.innerHTML = this.convert(from.value);
    }
};
Insta.convert = (wiki: string | string[]): string => {
    const ll = typeof wiki === "string" ? wiki.replace(/\r/g, "").split(/\n/) : wiki;
    let o = "",
        p: number | boolean = 0,
        r: RegExpMatchArray | null = null;
    const remain = () => ll.length;
    const sh = (): string => ll.shift() ?? "";
    const ps = (s: string) => {
        o += s;
    };
    const f = (...a: unknown[]): string => {
        let i = 1,
            f = a[0] as string,
            o = "",
            c: number, p: number;
        for (; i < a.length; i++) {
            if ((p = f.indexOf("?")) + 1) {
                i -= c = f.charAt(p + 1) === "?" ? 1 : 0;
                o += f.substring(0, p) + (c ? "?" : String(a[i]));
                f = f.slice(p + 1 + c);
            } else {
                break;
            }
        }
        return o + f;
    };
    const html_entities = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const htmlescape_text = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/:/g, "&#58;").replace(/\[/g, "&#91;").replace(/]/g, "&#93;");
    const htmlescape_attr = (s: string) => htmlescape_text(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
    const str_imatch = (a: string, b: string) => {
        const l = Math.min(a.length, b.length);
        let i;
        for (i = 0; i < l; i++) {
            if (a.charAt(i) !== b.charAt(i)) {
                break;
            }
        }
        return i;
    };
    const compareLineStringOrReg = (c: string | RegExp): boolean | RegExpMatchArray | null => {
        if (typeof c === "string") {
            return ll[0]?.startsWith(c);
        }
        r = ll[0] ? ll[0].match(c) : null;
        return r;
    };
    const compareLineString = (c: string) => ll[0] === c;
    const charAtPoint = (p: number) => ll[0].charAt(p);
    const endl = (s: string) => {
        ps(s);
        sh();
    };
    const parse_list = () => {
        let prev = "";
        while (remain() && compareLineStringOrReg(/^([*#:;]+)(.*)$/)) {
            const l_match = assume(r);
            sh();
            const ipos = str_imatch(prev, l_match[1]);
            for (let prevPos = prev.length - 1; prevPos >= ipos; prevPos--) {
                const pi = prev.charAt(prevPos);
                if (pi === "*") {
                    ps("</ul>");
                } else if (pi === "#") {
                    ps("</ol>");
                } else if ($.inArray(l_match[1].charAt(prevPos), ["", "*", "#"])) {
                    ps("</dl>");
                }
            }
            for (let matchPos = ipos; matchPos < l_match[1].length; matchPos++) {
                const li = l_match[1].charAt(matchPos);
                if (li === "*") {
                    ps("<ul>");
                } else if (li === "#") {
                    ps("<ol>");
                } else if ($.inArray(prev.charAt(matchPos), ["", "*", "#"])) {
                    ps("<dl>");
                }
            }
            switch (l_match[1].charAt(l_match[1].length - 1)) {
                case "*":
                case "#":
                    ps(`<li>${parse_inline_nowiki(l_match[2])}`);
                    break;
                case ";": {
                    ps("<dt>");
                    const dt_match = /(.*?)(:.*?)$/.exec(l_match[2]);
                    if (dt_match) {
                        ps(parse_inline_nowiki(dt_match[1]));
                        ll.unshift(dt_match[2]);
                    } else {
                        ps(parse_inline_nowiki(l_match[2]));
                    }
                    break;
                }
                case ":":
                    ps(`<dd>${parse_inline_nowiki(l_match[2])}`);
            }
            prev = l_match[1];
        }
        for (let i = prev.length - 1; i >= 0; i--) {
            ps(f("</?>", prev.charAt(i) === "*" ? "ul" : prev.charAt(i) === "#" ? "ol" : "dl"));
        }
    };
    const parse_table = () => {
        endl(f("<table>", compareLineStringOrReg(/^\{\|( .*)$/) ? assume(r)[1] : ""));
        while (remain()) {
            if (compareLineStringOrReg("|")) {
                switch (charAtPoint(1)) {
                    case "}":
                        endl("</table>");
                        return;
                    case "-":
                        endl(f("<tr>", (compareLineStringOrReg(/\|-*(.*)/) as RegExpMatchArray)[1]));
                        break;
                    default:
                        parse_table_data();
                }
            } else if (compareLineStringOrReg("!")) {
                parse_table_data();
            } else {
                sh();
            }
        }
    };
    const parse_table_data = () => {
        let td_line: string[];
        let match_i: number;
        const td_match = /^(\|\+|\||!)((?:([^[|]*?)\|(?!\|))?(.*))$/.exec(sh());
        if (!td_match) {
            return;
        }
        if (td_match[1] === "|+") {
            ps("<caption");
        } else {
            ps(`<t${td_match[1] === "|" ? "d" : "h"}`);
        }
        if (typeof td_match[3] !== "undefined") {
            match_i = 4;
        } else {
            match_i = 2;
        }
        ps(">");
        if (td_match[1] !== "|+") {
            td_line = td_match[match_i].split(td_match[1] === "|" ? "||" : /(?:\|\||!!)/);
            ps(parse_inline_nowiki(td_line.shift() ?? ""));
            while (td_line.length) {
                ll.unshift(td_match[1] + (td_line.pop() ?? ""));
            }
        } else {
            ps(parse_inline_nowiki(td_match[match_i]));
        }
        let tc = 0;
        const td: string[] = [];
        while (remain()) {
            td.push(sh());
            if (compareLineStringOrReg("|")) {
                if (!tc) {
                    break;
                } else if (charAtPoint(1) === "}") {
                    tc--;
                }
            } else if (!tc && compareLineStringOrReg("!")) {
                break;
            } else if (compareLineStringOrReg("{|")) {
                tc++;
            }
        }
        if (td.length) {
            ps(Insta.convert(td));
        }
    };
    const parse_pre = () => {
        ps("<pre>");
        do {
            endl(`${parse_inline_nowiki(ll[0].substring(1))}\n`);
        } while (remain() && compareLineStringOrReg(" "));
        ps("</pre>");
    };
    const parse_block_image = () => {
        ps(parse_image(sh()));
    };
    const parse_image = (str: string): string => {
        let tag = str.substring(str.indexOf(":") + 1, str.length - 2);
        const attr: unknown[] = [];
        if (/\|/.exec(tag)) {
            let nesting = 0;
            let last_attr: string | undefined;
            for (let i = tag.length - 1; i > 0; i--) {
                if (tag.charAt(i) === "|" && !nesting) {
                    last_attr = tag.slice(i + 1);
                    tag = tag.substring(0, i);
                    break;
                } else {
                    switch (tag.slice(i - 1, i + 1)) {
                        case "]]":
                            nesting++;
                            i--;
                            break;
                        case "[[":
                            nesting--;
                            i--;
                    }
                }
            }
            attr.length = 0;
            attr.push(...tag.split(/\s*\|\s*/));
            attr.push(last_attr);
        }
        return "";
    };
    const parse_inline_nowiki = (str: string): string => {
        let start: number, lastend = 0;
        let substart = 0,
            nestlev = 0,
            open: number, close: number, subloop: boolean;
        let html = "";
        while (-1 !== (start = str.indexOf("<nowiki>", substart))) {
            html += parse_inline_wiki(str.substring(lastend, start));
            start += 8;
            substart = start;
            subloop = true;
            do {
                open = str.indexOf("<nowiki>", substart);
                close = str.indexOf("</nowiki>", substart);
                if (close <= open || open === -1) {
                    if (close === -1) {
                        return html + html_entities(str.slice(start));
                    }
                    substart = close + 9;
                    if (nestlev) {
                        nestlev--;
                    } else {
                        lastend = substart;
                        html += html_entities(str.substring(start, lastend - 9));
                        subloop = false;
                    }
                } else {
                    substart = open + 8;
                    nestlev++;
                }
            } while (subloop);
        }
        return html + parse_inline_wiki(str.slice(lastend));
    };
    const parse_inline_images = (_str: string): string => {
        let str = _str;
        let start: number, substart = 0,
            nestlev = 0;
        let loop: boolean, close: number, open: number, wiki: string, html: string;
        while (-1 !== (start = str.indexOf("[[", substart))) {
            if (RegExp(`^(Image|File|${Insta.conf.locale.image}):`, "i").exec(str.slice(start + 2))) {
                loop = true;
                substart = start;
                do {
                    substart += 2;
                    close = str.indexOf("]]", substart);
                    open = str.indexOf("[[", substart);
                    if (close <= open || open === -1) {
                        if (close === -1) {
                            return str;
                        }
                        substart = close;
                        if (nestlev) {
                            nestlev--;
                        } else {
                            wiki = str.substring(start, close + 2);
                            html = parse_image(wiki);
                            str = str.replace(wiki, html);
                            substart = start + html.length;
                            loop = false;
                        }
                    } else {
                        substart = open;
                        nestlev++;
                    }
                } while (loop);
            } else {
                break;
            }
        }
        return str;
    };
    const parse_inline_formatting = (str: string): string => {
        let italic: boolean | undefined, bold: boolean | undefined, i: number, li = 0, o = "";
        while ((i = str.indexOf("''", li)) + 1) {
            o += str.substring(li, i);
            li = i + 2;
            if (str.charAt(i + 2) === "'") {
                li++;
                bold = !bold;
                o += bold ? "<b>" : "</b>";
            } else {
                italic = !italic;
                o += italic ? "<i>" : "</i>";
            }
        }
        return o + str.slice(li);
    };
    const parse_inline_wiki = (_str: string): string => {
        let str = _str;
        str = parse_inline_images(str);
        str = str.replace(/<(?:)math>(.*?)<\/math>/gi, "");
        const date = new Date();
        let minutes: number | string = date.getUTCMinutes();
        if (minutes < 10) {
            minutes = `0${minutes}`;
        }
        const dateStr = f("?:?, ? ? ? (UTC)", date.getUTCHours(), minutes, date.getUTCDate(), Insta.conf.locale.months[date.getUTCMonth()], date.getUTCFullYear());
        str = str
            .replace(/~{5}(?!~)/g, dateStr).replace(/~{4}(?!~)/g, `${String(Insta.conf.user.name)} ${dateStr}`).replace(/~{3}(?!~)/g, String(Insta.conf.user.name))
            .replace(RegExp(`\\[\\[:((?:${Insta.conf.locale.category}|Image|File|${Insta.conf.locale.image}|${Insta.conf.wiki.interwiki}):[^|]*?)\\]\\](\\w*)`, "gi"), ($0: string, $1: string, $2: string) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($1) + htmlescape_text($2)))
            .replace(RegExp(`\\[\\[(?:${Insta.conf.locale.category}|${Insta.conf.wiki.interwiki}):.*?\\]\\]`, "gi"), "")
            .replace(RegExp(`\\[\\[:((?:${Insta.conf.locale.category}|Image|File|${Insta.conf.locale.image}|${Insta.conf.wiki.interwiki}):.*?)\\|([^\\]]+?)\\]\\](\\w*)`, "gi"), ($0: string, $1: string, $2: string, $3: string) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($2) + htmlescape_text($3)))
            .replace(/\[\[(\/[^|]*?)\]\]/g, ($0: string, $1: string) => f("<a href='?'>?</a>", String(Insta.conf.baseUrl) + htmlescape_attr($1), htmlescape_text($1)))
            .replace(/\[\[(\/.*?)\|(.+?)\]\]/g, ($0: string, $1: string, $2: string) => f("<a href='?'>?</a>", String(Insta.conf.baseUrl) + htmlescape_attr($1), htmlescape_text($2)))
            .replace(/\[\[([^[|]*?)\]\](\w*)/g, ($0: string, $1: string, $2: string) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($1) + htmlescape_text($2)))
            .replace(/\[\[([^[]*?)\|([^\]]+?)\]\](\w*)/g, ($0: string, $1: string, $2: string, $3: string) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($2) + htmlescape_text($3)))
            .replace(/\[\[([^\]]*?:)?(.*?)( *\(.*?\))?\|\]\]/g, ($0: string, $1: string | undefined, $2: string, $3: string | undefined) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1 ?? "") + htmlescape_attr($2) + htmlescape_attr($3 ?? ""), htmlescape_text($2)))
            .replace(/\[(https?|news|ftp|mailto|gopher|irc):(\/*)([^\]]*?) (.*?)\]/g, ($0: string, $1: string, $2: string, $3: string, $4: string) => f("<a class='external' href='?:?'>?</a>", htmlescape_attr($1), htmlescape_attr($2) + htmlescape_attr($3), htmlescape_text($4)))
            .replace(/\[http:\/\/(.*?)\]/g, ($0: string, $1: string) => f("<a class='external' href='http://?'>[#]</a>", htmlescape_attr($1)))
            .replace(/\[(news|ftp|mailto|gopher|irc):(\/*)(.*?)\]/g, ($0: string, $1: string, $2: string, $3: string) => f("<a class='external' href='?:?'>?:?</a>", htmlescape_attr($1), htmlescape_attr($2) + htmlescape_attr($3), htmlescape_text($1), htmlescape_text($2) + htmlescape_text($3)))
            .replace(/(^| )(https?|news|ftp|mailto|gopher|irc):(\/*)([^ $]*[^.,!?;: $])/g, ($0: string, $1: string, $2: string, $3: string, $4: string) => f("?<a class='external' href='?:?'>?:?</a>", htmlescape_text($1), htmlescape_attr($2), htmlescape_attr($3) + htmlescape_attr($4), htmlescape_text($2), htmlescape_text($3) + htmlescape_text($4)))
            .replace("__NOTOC__", "").replace("__NOINDEX__", "").replace("__INDEX__", "").replace("__NOEDITSECTION__", "");
        return parse_inline_formatting(str);
    };
    while (remain()) {
        if (compareLineStringOrReg(/^(={1,6})(.*)\1(.*)$/)) {
            p = 0;
            const m = r as unknown as RegExpMatchArray;
            endl(f("<h?>?</h?>?", m[1].length, parse_inline_nowiki(m[2]), m[1].length, m[3]));
        } else if (compareLineStringOrReg(/^[*#:;]/)) {
            p = 0;
            parse_list();
        } else if (compareLineStringOrReg(" ")) {
            p = 0;
            parse_pre();
        } else if (compareLineStringOrReg("{|")) {
            p = 0;
            parse_table();
        } else if (compareLineStringOrReg(/^----+$/)) {
            p = 0;
            endl("<hr />");
        } else if (compareLineStringOrReg(Insta.BLOCK_IMAGE)) {
            p = 0;
            parse_block_image();
        } else {
            if (compareLineString("")) {
                p = remain() > 1 && ll[1] === "";
                if (p) {
                    endl("<p><br>");
                }
            } else {
                if (!p) {
                    ps("<p>");
                    p = 1;
                }
                ps(`${parse_inline_nowiki(ll[0])} `);
            }
            sh();
        }
    }
    return o;
};
export const wiki2html = (txt: string, baseurl?: string) => {
    Insta.conf.baseUrl = baseurl;
    return Insta.convert(txt);
};
