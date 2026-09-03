import { autoClickToken } from "./autoedit.ts";
import { titledDiffLink } from "./diffpreview.ts";
import { errlog, pg } from "./globals.ts";
import { arinLink, editCounterLink, editorListLink, globalSearchLink, googleLink, magicHistoryLink, magicWatchLink, popupMenuLink, specialLink, titledWikiLink, wikiLink } from "./links.ts";
import type { LinkSpec } from "./links.ts";
import { getValueOf } from "./options.ts";
import { addPopupShortcut } from "./shortcutkeys.ts";
import { popupString, tprintf } from "./strings.ts";
import { isInMainNamespace, isInStrippableNamespace, safeDecodeURI } from "./titles.ts";
import type { Title } from "./titles.ts";
import { assume } from "./tools.ts";
const defaultNavlinkSpec = () => {
    let str = "";
    str += "<b><<mainlink|shortcut= >></b>";
    if (getValueOf("popupLastEditLink")) {
        str += "*<<lastEdit|shortcut=/>>|<<lastContrib>>|<<sinceMe>>if(oldid){|<<oldEdit>>|<<diffCur>>}";
    }
    str += "if(user){<br><<contribs|shortcut=c>>*<<userlog|shortcut=L|log>>";
    str += "if(ipuser){*<<arin>>}if(wikimedia){*<<count|shortcut=#>>}";
    str += "if(ipuser){}else{*<<email|shortcut=E>>}if(admin){*<<block|shortcut=b>>|<<blocklog|log>>}}";
    const editstr = "<<edit|shortcut=e>>";
    const editOldidStr = `if(oldid){<<editOld|shortcut=e>>|<<revert|shortcut=v|rv>>|<<edit|cur>>}else{${editstr}}`;
    const historystr = "<<history|shortcut=h>>|<<editors|shortcut=E|>>";
    const watchstr = "<<unwatch|unwatchShort>>|<<watch|shortcut=w|watchThingy>>";
    str += `<br>if(talk){${editOldidStr}|<<new|shortcut=+>>*${historystr}*${watchstr}*<b><<article|shortcut=a>></b>|<<editArticle|edit>>}else{${editOldidStr}*${historystr}*${watchstr}*<b><<talk|shortcut=t>></b>|<<editTalk|edit>>|<<newTalk|shortcut=+|new>>}`;
    str += "<br><<whatLinksHere|shortcut=l>>*<<relatedChanges|shortcut=r>>*<<move|shortcut=m>>";
    str += "if(admin){<br><<unprotect|unprotectShort>>|<<protect|shortcut=p>>|<<protectlog|log>>*<<undelete|undeleteShort>>|<<delete|shortcut=d>>|<<deletelog|log>>}";
    return str;
};
export const navLinksHTML = (article: Title, hint?: string | null, params?: Record<string, string | null>) => {
    const str = `<span class="popupNavLinks">${defaultNavlinkSpec()}</span>`;
    return navlinkStringToHTML(str, article, params);
};
const expandConditionalNavlinkString = (s: string, article: Title, z: Record<string, string | null>, _recursionCount?: number): string => {
    const oldid = z.oldid,
        rcid = z.rcid,
        diff = z.diff;
    let recursionCount = _recursionCount;
    if (typeof recursionCount !== "number") {
        recursionCount = 0;
    }
    const conditionalSplitRegex = RegExp("(;?\\s*if\\s*\\(\\s*([\\w]*)\\s*\\)\\s*\\{([^{}]*)\\}(\\s*else\\s*\\{([^{}]*?)\\}|))", "i");
    const splitted = s.parenSplit(conditionalSplitRegex);
    const numParens = 5;
    let ret = splitted[0];
    for (let i = 1; i < splitted.length; i = i + numParens + 1) {
        const testString = splitted[i + 2 - 1];
        const trueString = splitted[i + 3 - 1];
        let falseString = splitted[i + 5 - 1];
        if (typeof falseString === "undefined" || !falseString) {
            falseString = "";
        }
        let testResult: boolean | null = null;
        switch (testString) {
            case "user":
                testResult = !!article.userName();
                break;
            case "talk":
                testResult = !!article.talkPage();
                break;
            case "admin":
                testResult = !!getValueOf("popupAdminLinks");
                break;
            case "oldid":
                testResult = !!(typeof oldid !== "undefined" && oldid);
                break;
            case "rcid":
                testResult = !!(typeof rcid !== "undefined" && rcid);
                break;
            case "ipuser":
                testResult = article.isIpUser();
                break;
            case "mainspace_en":
                testResult = isInMainNamespace(article) && pg.wiki.hostname === "en.wikipedia.org";
                break;
            case "wikimedia":
                testResult = pg.wiki.wikimedia;
                break;
            case "diff":
                testResult = !!(typeof diff !== "undefined" && diff);
                break;
        }
        switch (testResult) {
            case null:
                ret += splitted[i];
                break;
            case true:
                ret += trueString;
                break;
            case false:
                ret += falseString;
                break;
        }
        ret += splitted[i + numParens];
    }
    if (conditionalSplitRegex.test(ret) && recursionCount < 10) {
        return expandConditionalNavlinkString(ret, article, z, recursionCount + 1);
    }
    return ret;
};
const navlinkStringToArray = (_s: string, article: Title, params: Record<string, string | null>) => {
    const s = expandConditionalNavlinkString(_s, article, params);
    const splitted = s.parenSplit(/<<(.*?)>>/);
    const ret: (NavlinkTag | string)[] = [];
    for (let i = 0; i < splitted.length; ++i) {
        if (i % 2) {
            const t = new NavlinkTag();
            const ss = splitted[i].split("|");
            t.id = ss[0];
            for (let j = 1; j < ss.length; ++j) {
                const sss = ss[j].split("=");
                if (sss.length > 1) {
                    t[sss[0]] = sss[1];
                } else {
                    t.text = popupString(sss[0]);
                }
            }
            t.article = article;
            const oldid = params.oldid,
                rcid = params.rcid,
                diff = params.diff;
            if (typeof oldid !== "undefined" && oldid !== null) {
                t.oldid = oldid;
            }
            if (typeof rcid !== "undefined" && rcid !== null) {
                t.rcid = rcid;
            }
            if (typeof diff !== "undefined" && diff !== null) {
                t.diff = diff;
            }
            if (!t.text && t.id !== "mainlink") {
                t.text = popupString(t.id);
            }
            ret.push(t);
        } else {
            ret.push(splitted[i]);
        }
    }
    return ret;
};
const navlinkSubstituteHTML = (s: string) => s.split("*").join(getValueOf("popupNavLinkSeparator") as string).split("<menurow>").join('<li class="popup_menu_row">').split("</menurow>").join("</li>").split("<menu>").join('<ul class="popup_menu">').split("</menu>").join("</ul>");
const navlinkDepth = (magic: string, s: string) => s.split(`<${magic}>`).length - s.split(`</${magic}>`).length;
export const navlinkStringToHTML = (s: string, article: Title, params?: Record<string, string | null>) => {
    const p = navlinkStringToArray(s, article, params ?? {});
    let html = "";
    let menudepth = 0;
    let menurowdepth = 0;
    for (const item of p) {
        if (typeof item === "string") {
            html += navlinkSubstituteHTML(item);
            menudepth += navlinkDepth("menu", item);
            menurowdepth += navlinkDepth("menurow", item);
        } else if (typeof item.type !== "undefined" && item.type === "navlinkTag") {
            if (menudepth > 0 && menurowdepth === 0) {
                html += `<li class="popup_menu_item">${item.html()}</li>`;
            } else {
                html += item.html();
            }
        }
    }
    return html;
};
type NavlinkPrintFn = (this: NavlinkTag, l: LinkSpec) => string | null;
class NavlinkTag implements LinkSpec {
    type = "navlinkTag";
    id!: string;
    article!: Title;
    text?: string;
    title?: string | null;
    oldid?: string | null;
    rcid?: string;
    diff?: string | null;
    newWin?: boolean | null;
    noPopup?: boolean | number | null;
    specialpage?: string;
    sep?: string | null;
    action?: string;
    actionName?: string;
    from?: string | number | null;
    to?: string | null;
    shortcut?: string;
    print?: NavlinkPrintFn;
    [key: string]: unknown;
    html() {
        this.getNewWin();
        this.getPrintFunction();
        let html: string | null = "";
        const tagType = "span";
        const opening = `<${tagType} class="popup_${this.id}">`;
        const closing = `</${tagType}>`;
        if (typeof this.print !== "function") {
            errlog(`Oh dear - invalid print function for a navlinkTag, id=${this.id}`);
        } else {
            html = this.print(this);
            if (typeof html !== "string") {
                html = "";
            } else if (typeof this.shortcut !== "undefined") {
                html = addPopupShortcut(html, this.shortcut);
            }
        }
        return opening + String(html) + closing;
    }
    getNewWin() {
        getValueOf("popupLinksNewWindow");
        const linksNewWin = pg.option.popupLinksNewWindow as Record<string, boolean | null> | undefined;
        if (typeof linksNewWin?.[this.id] === "undefined") {
            this.newWin = null;
        }
        this.newWin = linksNewWin?.[this.id];
    }
    getPrintFunction() {
        if (typeof this.id !== typeof "" || typeof this.article !== typeof {}) {
            return;
        }
        this.noPopup = 1;
        switch (this.id) {
            case "contribs":
            case "history":
            case "whatLinksHere":
            case "userPage":
            case "monobook":
            case "userTalk":
            case "talk":
            case "article":
            case "lastEdit":
                this.noPopup = null;
        }
        switch (this.id) {
            case "email":
            case "contribs":
            case "block":
            case "unblock":
            case "userlog":
            case "userSpace":
            case "deletedContribs":
                this.article = assume(this.article.userName());
        }
        switch (this.id) {
            case "userTalk":
            case "newUserTalk":
            case "editUserTalk":
            case "userPage":
            case "monobook":
            case "editMonobook":
            case "blocklog":
                this.article = assume(this.article.userName(true));
                Reflect.deleteProperty(this, "oldid");
                break;
            case "pagelog":
            case "deletelog":
            case "protectlog":
                Reflect.deleteProperty(this, "oldid");
        }
        if (this.id === "editMonobook" || this.id === "monobook") {
            this.article.append("/monobook.js");
        }
        if (this.id !== "mainlink") {
            this.article = this.article.removeAnchor();
        }
        switch (this.id) {
            case "undelete":
                this.print = specialLink;
                this.specialpage = "Undelete";
                this.sep = "/";
                break;
            case "whatLinksHere":
                this.print = specialLink;
                this.specialpage = "Whatlinkshere";
                break;
            case "relatedChanges":
                this.print = specialLink;
                this.specialpage = "Recentchangeslinked";
                break;
            case "move":
                this.print = specialLink;
                this.specialpage = "Movepage";
                break;
            case "contribs":
                this.print = specialLink;
                this.specialpage = "Contributions";
                break;
            case "deletedContribs":
                this.print = specialLink;
                this.specialpage = "Deletedcontributions";
                break;
            case "email":
                this.print = specialLink;
                this.specialpage = "EmailUser";
                this.sep = "/";
                break;
            case "block":
                this.print = specialLink;
                this.specialpage = "Blockip";
                this.sep = "&ip=";
                break;
            case "unblock":
                this.print = specialLink;
                this.specialpage = "Ipblocklist";
                this.sep = "&action=unblock&ip=";
                break;
            case "userlog":
                this.print = specialLink;
                this.specialpage = "Log";
                this.sep = "&user=";
                break;
            case "blocklog":
                this.print = specialLink;
                this.specialpage = "Log";
                this.sep = "&type=block&page=";
                break;
            case "pagelog":
                this.print = specialLink;
                this.specialpage = "Log";
                this.sep = "&page=";
                break;
            case "protectlog":
                this.print = specialLink;
                this.specialpage = "Log";
                this.sep = "&type=protect&page=";
                break;
            case "deletelog":
                this.print = specialLink;
                this.specialpage = "Log";
                this.sep = "&type=delete&page=";
                break;
            case "userSpace":
                this.print = specialLink;
                this.specialpage = "PrefixIndex";
                this.sep = "&namespace=2&prefix=";
                break;
            case "search":
                this.print = specialLink;
                this.specialpage = "Search";
                this.sep = "&fulltext=Search&search=";
                break;
            case "thank":
                this.print = specialLink;
                this.specialpage = "Thanks";
                this.sep = "/";
                this.article.value = this.diff !== "prev" ? this.diff ?? null : this.oldid ?? null;
                break;
            case "unwatch":
            case "watch":
                this.print = magicWatchLink;
                this.action = `${this.id}&autowatchlist=1&autoimpl=${popupString("autoedit_version")}&actoken=${autoClickToken()}`;
                break;
            case "history":
            case "historyfeed":
            case "unprotect":
            case "protect":
                this.print = wikiLink;
                this.action = this.id;
                break;
            case "delete":
                this.print = wikiLink;
                this.action = "delete";
                if (this.article.namespaceId() === pg.nsImageId) {
                    const img = this.article.stripNamespace();
                    this.action += `&image=${img}`;
                }
                break;
            case "markpatrolled":
            case "edit":
                Reflect.deleteProperty(this, "oldid");
                this.print = wikiLink;
                this.action = this.id;
                break;
            case "view":
            case "purge":
            case "render":
                this.print = wikiLink;
                this.action = this.id;
                break;
            case "raw":
                this.print = wikiLink;
                this.action = "raw";
                break;
            case "new":
                this.print = wikiLink;
                this.action = "edit&section=new";
                break;
            case "mainlink":
                if (typeof this.text === "undefined") {
                    this.text = this.article.toString().entify();
                }
                if (getValueOf("popupSimplifyMainLink") && isInStrippableNamespace(this.article)) {
                    const s = this.text.split("/");
                    this.text = s[s.length - 1];
                    if (this.text === "" && s.length > 1) {
                        this.text = s[s.length - 2];
                    }
                }
                this.print = titledWikiLink;
                if (typeof this.title === "undefined" && typeof pg.current.link?.href !== "undefined") {
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string is a meaningful value here; the || branch is deliberate upstream behavior
                    this.title = safeDecodeURI(pg.current.link.originalTitle ? pg.current.link.originalTitle : this.article) as string;
                    if (typeof this.oldid !== "undefined" && this.oldid) {
                        this.title = tprintf("Revision %s of %s", [this.oldid, this.title]);
                    }
                }
                this.action = "view";
                break;
            case "userPage":
            case "article":
            case "monobook":
            case "editMonobook":
            case "editArticle":
                Reflect.deleteProperty(this, "oldid");
                this.article = this.article.articleFromTalkOrArticle();
                this.print = wikiLink;
                if (this.id.startsWith("edit")) {
                    this.action = "edit";
                } else {
                    this.action = "view";
                }
                break;
            case "userTalk":
            case "talk":
                this.article = assume(this.article.talkPage());
                Reflect.deleteProperty(this, "oldid");
                this.print = wikiLink;
                this.action = "view";
                break;
            case "arin":
                this.print = arinLink;
                break;
            case "count":
                this.print = editCounterLink;
                break;
            case "google":
                this.print = googleLink;
                break;
            case "editors":
                this.print = editorListLink;
                break;
            case "globalsearch":
                this.print = globalSearchLink;
                break;
            case "lastEdit":
                this.print = titledDiffLink;
                this.title = popupString("Show the last edit");
                this.from = "prev";
                this.to = "cur";
                break;
            case "oldEdit":
                this.print = titledDiffLink;
                this.title = `${popupString("Show the edit made to get revision")} ${String(this.oldid)}`;
                this.from = "prev";
                this.to = this.oldid;
                break;
            case "editOld":
                this.print = wikiLink;
                this.action = "edit";
                break;
            case "undo":
                this.print = wikiLink;
                this.action = "edit&undo=";
                break;
            case "revert":
                this.print = wikiLink;
                this.action = "revert";
                break;
            case "nullEdit":
                this.print = wikiLink;
                this.action = "nullEdit";
                break;
            case "diffCur":
                this.print = titledDiffLink;
                this.title = tprintf("Show changes since revision %s", [this.oldid]);
                this.from = this.oldid ?? null;
                this.to = "cur";
                break;
            case "editUserTalk":
            case "editTalk":
                Reflect.deleteProperty(this, "oldid");
                this.article = assume(this.article.talkPage());
                this.action = "edit";
                this.print = wikiLink;
                break;
            case "newUserTalk":
            case "newTalk":
                this.article = assume(this.article.talkPage());
                this.action = "edit&section=new";
                this.print = wikiLink;
                break;
            case "lastContrib":
            case "sinceMe":
                this.print = magicHistoryLink;
                break;
            case "togglePreviews":
                this.text = popupString(pg.option.simplePopups ? "enable previews" : "disable previews");
                this.print = popupMenuLink;
                break;
            case "disablePopups":
            case "purgePopups":
                this.print = popupMenuLink;
                break;
            default:
                this.print = function () {
                    return `Unknown navlink type: ${this.id}`;
                };
        }
    }
}
