// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { pg } from "./globals.ts";
    export const Insta = {};
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
                user: mw.config.get("wgFormattedNamespaces")[pg.nsUserId],
                image: mw.config.get("wgFormattedNamespaces")[pg.nsImageId],
                category: mw.config.get("wgFormattedNamespaces")[pg.nsCategoryId],
                months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            },
        };
        Insta.conf.user.name ||= "Wikipedian";
        Insta.conf.user.signature = `[[${Insta.conf.locale.user}:${Insta.conf.user.name}|${Insta.conf.user.name}]]`;
        Insta.BLOCK_IMAGE = new RegExp(`^\\[\\[(?:File|Image|${Insta.conf.locale.image}):.*?\\|.*?(?:frame|thumbnail|thumb|none|right|left|center)`, "i");
    };
    Insta.dump = function (_from, _to) {
        let from = _from, to = _to;
        if (typeof from === "string") {
            from = document.getElementById(from);
        }
        if (typeof to === "string") {
            to = document.getElementById(to);
        }
        to.innerHTML = this.convert(from.value);
    };
    Insta.convert = (wiki) => {
        const ll = typeof wiki === "string" ? wiki.replace(/\r/g, "").split(/\n/) : wiki;
        let o = "",
            p = 0,
            r;
        const remain = () => ll.length;
        const sh = () => ll.shift();
        const ps = (s) => {
            o += s;
        };
        const f = (...a) => {
            let i = 1,
                f = a[0],
                o = "",
                c, p;
            for (; i < a.length; i++) {
                if ((p = f.indexOf("?")) + 1) {
                    i -= c = f.charAt(p + 1) === "?" ? 1 : 0;
                    o += f.substring(0, p) + (c ? "?" : a[i]);
                    f = f.substr(p + 1 + c);
                } else {
                    break;
                }
            }
            return o + f;
        };
        const html_entities = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const htmlescape_text = (s) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/:/g, "&#58;").replace(/\[/g, "&#91;").replace(/]/g, "&#93;");
        const htmlescape_attr = (s) => htmlescape_text(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
        const str_imatch = (a, b) => {
            const l = Math.min(a.length, b.length);
            let i;
            for (i = 0; i < l; i++) {
                if (a.charAt(i) !== b.charAt(i)) {
                    break;
                }
            }
            return i;
        };
        const compareLineStringOrReg = (c) => typeof c === "string" ? ll[0] && ll[0].substr(0, c.length) === c : r = ll[0] && ll[0].match(c);
        const compareLineString = (c) => ll[0] === c;
        const charAtPoint = (p) => ll[0].charAt(p);
        const endl = (s) => {
            ps(s);
            sh();
        };
        const parse_list = () => {
            let prev = "";
            while (remain() && compareLineStringOrReg(/^([*#:;]+)(.*)$/)) {
                const l_match = r;
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
                        const dt_match = l_match[2].match(/(.*?)(:.*?)$/);
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
            endl(f("<table>", compareLineStringOrReg(/^\{\|( .*)$/) ? r[1] : ""));
            while (remain()) {
                if (compareLineStringOrReg("|")) {
                    switch (charAtPoint(1)) {
                        case "}":
                            endl("</table>");
                            return;
                        case "-":
                            endl(f("<tr>", compareLineStringOrReg(/\|-*(.*)/)[1]));
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
            let td_line, match_i;
            const td_match = sh().match(/^(\|\+|\||!)((?:([^[|]*?)\|(?!\|))?(.*))$/);
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
                ps(parse_inline_nowiki(td_line.shift()));
                while (td_line.length) {
                    ll.unshift(td_match[1] + td_line.pop());
                }
            } else {
                ps(parse_inline_nowiki(td_match[match_i]));
            }
            let tc = 0;
            const td = [];
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
        const parse_image = (str) => {
            let tag = str.substring(str.indexOf(":") + 1, str.length - 2);
            const attr = [];
            if (tag.match(/\|/)) {
                let nesting = 0;
                let last_attr;
                for (let i = tag.length - 1; i > 0; i--) {
                    if (tag.charAt(i) === "|" && !nesting) {
                        last_attr = tag.substr(i + 1);
                        tag = tag.substring(0, i);
                        break;
                    } else {
                        switch (tag.substr(i - 1, 2)) {
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
        const parse_inline_nowiki = (str) => {
            let start, lastend = 0;
            let substart = 0,
                nestlev = 0,
                open, close, subloop;
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
                            return html + html_entities(str.substr(start));
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
            return html + parse_inline_wiki(str.substr(lastend));
        };
        const parse_inline_images = (_str) => {
            let str = _str;
            let start, substart = 0,
                nestlev = 0;
            let loop, close, open, wiki, html;
            while (-1 !== (start = str.indexOf("[[", substart))) {
                if (str.substr(start + 2).match(RegExp(`^(Image|File|${Insta.conf.locale.image}):`, "i"))) {
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
        const parse_inline_formatting = (str) => {
            let italic, bold, i, li, o = "";
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
            return o + str.substr(li);
        };
        const parse_inline_wiki = (_str) => {
            let str = _str;
            str = parse_inline_images(str);
            str = str.replace(/<(?:)math>(.*?)<\/math>/gi, "");
            let date = new Date();
            let minutes = date.getUTCMinutes();
            if (minutes < 10) {
                minutes = `0${minutes}`;
            }
            date = f("?:?, ? ? ? (UTC)", date.getUTCHours(), minutes, date.getUTCDate(), Insta.conf.locale.months[date.getUTCMonth()], date.getUTCFullYear());
            str = str
                .replace(/~{5}(?!~)/g, date).replace(/~{4}(?!~)/g, `${Insta.conf.user.name} ${date}`).replace(/~{3}(?!~)/g, Insta.conf.user.name)
                .replace(RegExp(`\\[\\[:((?:${Insta.conf.locale.category}|Image|File|${Insta.conf.locale.image}|${Insta.conf.wiki.interwiki}):[^|]*?)\\]\\](\\w*)`, "gi"), ($0, $1, $2) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($1) + htmlescape_text($2)))
                .replace(RegExp(`\\[\\[(?:${Insta.conf.locale.category}|${Insta.conf.wiki.interwiki}):.*?\\]\\]`, "gi"), "")
                .replace(RegExp(`\\[\\[:((?:${Insta.conf.locale.category}|Image|File|${Insta.conf.locale.image}|${Insta.conf.wiki.interwiki}):.*?)\\|([^\\]]+?)\\]\\](\\w*)`, "gi"), ($0, $1, $2, $3) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($2) + htmlescape_text($3)))
                .replace(/\[\[(\/[^|]*?)\]\]/g, ($0, $1) => f("<a href='?'>?</a>", Insta.conf.baseUrl + htmlescape_attr($1), htmlescape_text($1)))
                .replace(/\[\[(\/.*?)\|(.+?)\]\]/g, ($0, $1, $2) => f("<a href='?'>?</a>", Insta.conf.baseUrl + htmlescape_attr($1), htmlescape_text($2)))
                .replace(/\[\[([^[|]*?)\]\](\w*)/g, ($0, $1, $2) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($1) + htmlescape_text($2)))
                .replace(/\[\[([^[]*?)\|([^\]]+?)\]\](\w*)/g, ($0, $1, $2, $3) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1), htmlescape_text($2) + htmlescape_text($3)))
                .replace(/\[\[([^\]]*?:)?(.*?)( *\(.*?\))?\|\]\]/g, ($0, $1, $2, $3) => f("<a href='?'>?</a>", Insta.conf.paths.articles + htmlescape_attr($1) + htmlescape_attr($2) + htmlescape_attr($3), htmlescape_text($2)))
                .replace(/\[(https?|news|ftp|mailto|gopher|irc):(\/*)([^\]]*?) (.*?)\]/g, ($0, $1, $2, $3, $4) => f("<a class='external' href='?:?'>?</a>", htmlescape_attr($1), htmlescape_attr($2) + htmlescape_attr($3), htmlescape_text($4)))
                .replace(/\[http:\/\/(.*?)\]/g, ($0, $1) => f("<a class='external' href='http://?'>[#]</a>", htmlescape_attr($1)))
                .replace(/\[(news|ftp|mailto|gopher|irc):(\/*)(.*?)\]/g, ($0, $1, $2, $3) => f("<a class='external' href='?:?'>?:?</a>", htmlescape_attr($1), htmlescape_attr($2) + htmlescape_attr($3), htmlescape_text($1), htmlescape_text($2) + htmlescape_text($3)))
                .replace(/(^| )(https?|news|ftp|mailto|gopher|irc):(\/*)([^ $]*[^.,!?;: $])/g, ($0, $1, $2, $3, $4) => f("?<a class='external' href='?:?'>?:?</a>", htmlescape_text($1), htmlescape_attr($2), htmlescape_attr($3) + htmlescape_attr($4), htmlescape_text($2), htmlescape_text($3) + htmlescape_text($4)))
                .replace("__NOTOC__", "").replace("__NOINDEX__", "").replace("__INDEX__", "").replace("__NOEDITSECTION__", "");
            return parse_inline_formatting(str);
        };
        while (remain()) {
            if (compareLineStringOrReg(/^(={1,6})(.*)\1(.*)$/)) {
                p = 0;
                endl(f("<h?>?</h?>?", r[1].length, parse_inline_nowiki(r[2]), r[1].length, r[3]));
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
    export const wiki2html = (txt, baseurl) => {
        Insta.conf.baseUrl = baseurl;
        return Insta.convert(txt);
    };
