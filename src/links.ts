import { setupTooltips } from "./actions.ts";
import { autoClickToken } from "./autoedit.ts";
import { abortAllDownloads, startDownload } from "./downloader.ts";
import type { Downloader } from "./downloader.ts";
import { errlog, log, pg } from "./globals.ts";
import { getMwApi, setupCache } from "./init.ts";
import { getValueOf } from "./options.ts";
import { addPopupShortcut } from "./shortcutkeys.ts";
import { popupString, tprintf } from "./strings.ts";
import { Title, parseParams, safeDecodeURI } from "./titles.ts";
import { anyChild, assume, getJsObj, simplePrintf } from "./tools.ts";
// A navlink spec as built by navlinks.ts: an article plus the display
// and target options of one popup navlink. Fields are optional because
// different builders consume different subsets.
export interface LinkSpec {
    article: Title;
    action?: string;
    actionName?: string;
    text?: string;
    newWin?: boolean | null;
    title?: string | null;
    oldid?: string | null;
    noPopup?: boolean | number | null;
    onclick?: string;
    className?: string | null;
    id?: string;
    specialpage?: string;
    sep?: string | null;
    rcid?: string;
    diff?: string | null;
    from?: string | number | null;
    to?: string | null;
}
// the subset generalLink/generalNavLink actually consume (no article)
export interface GeneralLinkSpec {
    url: string;
    newWin?: boolean | null;
    title?: string | null;
    text?: string | null;
    className?: string | null;
    noPopup?: boolean | number | null;
    onclick?: string;
}
export const wikiLink = (l: LinkSpec): string | null => {
    if (!(typeof l.article === typeof {} && typeof l.action === typeof "" && typeof l.text === typeof "")) {
        return null;
    }
    if (typeof l.oldid === "undefined") {
        l.oldid = null;
    }
    const savedOldid = l.oldid;
    if (!/^(edit|view|revert|render)$|^raw/.test(assume(l.action))) {
        l.oldid = null;
    }
    let hint = popupString(`${String(l.action)}Hint`);
    const oldidData = [l.oldid, safeDecodeURI(l.article)];
    let revisionString = tprintf("revision %s of %s", oldidData);
    log(`revisionString=${revisionString}`);
    switch (l.action) {
        case "edit&section=new":
            hint = popupString("newSectionHint");
            break;
        case "edit&undo=":
            if (l.diff && l.diff !== "prev" && savedOldid) {
                l.action = `${l.action}${l.diff}&undoafter=${savedOldid}`;
            } else if (savedOldid) {
                l.action = `${l.action}${savedOldid}`;
            }
            hint = popupString("undoHint");
            break;
        case "raw&ctype=text/css":
            hint = popupString("rawHint");
            break;
        case "revert": {
            const p = parseParams(pg.current.link?.href ?? "");
            l.action = `edit&autoclick=wpSave&actoken=${autoClickToken()}&autoimpl=${popupString("autoedit_version")}&autosummary=${revertSummary(l.oldid, p.diff)}`;
            if (p.diff === "prev") {
                l.action += "&direction=prev";
                revisionString = tprintf("the revision prior to revision %s of %s", oldidData);
            }
            if (getValueOf("popupRevertSummaryPrompt")) {
                l.action += "&autosummaryprompt=true";
            }
            if (getValueOf("popupMinorReverts")) {
                l.action += "&autominor=true";
            }
            log(`revisionString is now ${revisionString}`);
            break;
        }
        case "nullEdit":
            l.action = `edit&autoclick=wpSave&actoken=${autoClickToken()}&autoimpl=${popupString("autoedit_version")}&autosummary=${popupString("nullEditSummary")}`;
            break;
        case "historyfeed":
            l.action = "history&feed=rss";
            break;
        case "markpatrolled":
            l.action = `markpatrolled&rcid=${String(l.rcid)}`;
    }
    if (hint) {
        if (l.oldid) {
            hint = simplePrintf(hint, [revisionString]);
        } else {
            hint = simplePrintf(hint, [safeDecodeURI(l.article)]);
        }
    } else {
        hint = String(safeDecodeURI(`${String(l.article)}&action=${String(l.action)}`)) + String(l.oldid) ? `&oldid=${String(l.oldid)}` : "";
    }
    return titledWikiLink({
        article: l.article,
        action: l.action,
        text: l.text,
        newWin: l.newWin,
        title: hint,
        oldid: l.oldid,
        noPopup: l.noPopup,
        onclick: l.onclick,
    });
};
const revertSummary = (oldid: string | null, diff: string | null | undefined) => {
    let ret;
    if (diff === "prev") {
        ret = getValueOf("popupQueriedRevertToPreviousSummary");
    } else {
        ret = getValueOf("popupQueriedRevertSummary");
    }
    return `${ret as string}&autorv=${String(oldid)}`;
};
export const titledWikiLink = (l: LinkSpec): string | null => {
    if (typeof l.article === "undefined" || typeof l.action === "undefined") {
        errlog("got undefined article or action in titledWikiLink");
        return null;
    }
    const base = pg.wiki.titlebase + l.article.urlString();
    let url = base;
    if (typeof l.actionName === "undefined" || !l.actionName) {
        l.actionName = "action";
    }
    if (l.action !== "view") {
        url = `${base}&${l.actionName}=${l.action}`;
    }
    if (l.action === "edit") {
        url += "&wpChangeTags=Popups%2CAutomation%20tool";
    }
    if (typeof l.oldid !== "undefined" && l.oldid) {
        url += `&oldid=${l.oldid}`;
    }
    let cssClass = pg.misc.defaultNavlinkClassname;
    if (typeof l.className !== "undefined" && l.className) {
        cssClass = l.className;
    }
    return generalNavLink({
        url: url,
        newWin: l.newWin,
        title: typeof l.title !== "undefined" ? l.title : null,
        text: typeof l.text !== "undefined" ? l.text : null,
        className: cssClass,
        noPopup: l.noPopup,
        onclick: l.onclick,
    });
};
pg.fn.getLastContrib = (wikipage: string, newWin: boolean): void => {
    getHistoryInfo(wikipage, (x) => {
        processLastContribInfo(x, {
            page: wikipage,
            newWin: newWin,
        });
    });
};
interface HistoryEdit {
    oldid?: number;
    editor?: string;
}
interface HistoryMarker {
    index: number;
    oldid?: number;
    previd?: number | null;
}
export interface HistoryInfo {
    edits: HistoryEdit[];
    userName: string | null;
    myLastEdit?: HistoryMarker;
    firstNewEditor?: HistoryMarker;
}
const processLastContribInfo = (info: HistoryInfo, stuff: { page: string; newWin: boolean }): void => {
    if (!info.edits.length) {
        alert("Popups: an odd thing happened. Please retry.");
        return;
    }
    if (!info.firstNewEditor) {
        alert(tprintf("Only found one editor: %s made %s edits", [info.edits[0].editor, info.edits.length]));
        return;
    }
    const newUrl = `${pg.wiki.titlebase + new Title(stuff.page).urlString()}&diff=cur&oldid=${String(info.firstNewEditor.oldid)}`;
    displayUrl(newUrl, stuff.newWin);
};
pg.fn.getDiffSinceMyEdit = (wikipage: string, newWin: boolean): void => {
    getHistoryInfo(wikipage, (x) => {
        processDiffSinceMyEdit(x, {
            page: wikipage,
            newWin: newWin,
        });
    });
};
const processDiffSinceMyEdit = (info: HistoryInfo, stuff: { page: string; newWin: boolean }): void => {
    if (!info.edits.length) {
        alert("Popups: something fishy happened. Please try again.");
        return;
    }
    const friendlyName = stuff.page.split("_").join(" ");
    if (!info.myLastEdit) {
        alert(tprintf("Couldn't find an edit by %s\nin the last %s edits to\n%s", [info.userName, getValueOf("popupHistoryLimit"), friendlyName]));
        return;
    }
    if (info.myLastEdit.index === 0) {
        alert(tprintf("%s seems to be the last editor to the page %s", [info.userName, friendlyName]));
        return;
    }
    const newUrl = `${pg.wiki.titlebase + new Title(stuff.page).urlString()}&diff=cur&oldid=${String(info.myLastEdit.oldid)}`;
    displayUrl(newUrl, stuff.newWin);
};
const displayUrl = (url: string, newWin?: boolean | null) => {
    if (newWin) {
        window.open(url);
    } else {
        document.location = url;
    }
};
pg.fn.purgePopups = (): void => {
    processAllPopups(true);
    setupCache();
    pg.option = {};
    abortAllDownloads();
};
const processAllPopups = (nullify?: boolean, banish?: boolean) => {
    for (const link of pg.current.links) {
        if (!link.navpopup) {
            continue;
        }
        if (nullify || banish) {
            assume(link.navpopup).banish();
        }
        link.simpleNoMore = false;
        if (nullify) {
            link.navpopup = null;
        }
    }
};
pg.fn.disablePopups = (): void => {
    processAllPopups(false, true);
    setupTooltips(null, true);
};
pg.fn.togglePreviews = (): void => {
    processAllPopups(true, true);
    pg.option.simplePopups = !pg.option.simplePopups;
    abortAllDownloads();
};
export function magicWatchLink(this: { id?: string }, l: LinkSpec): string | null {
    l.onclick = simplePrintf("pg.fn.modifyWatchlist('%s','%s');return false;", [l.article.toString(true).split("\\").join("\\\\").split("'").join("\\'"), this.id]);
    return wikiLink(l);
}
pg.fn.modifyWatchlist = async (title: string | null, action: string | null): Promise<void> => {
    const reqData: {
        action: string;
        formatversion: number;
        titles: string;
        uselang: string;
        unwatch?: boolean;
    } = {
        action: "watch",
        formatversion: 2,
        titles: title ?? "",
        uselang: mw.config.get("wgUserLanguage"),
    };
    if (action === "unwatch") {
        reqData.unwatch = true;
    }
    const mwTitle = mw.Title.newFromText(title ?? "");
    let messageName;
    if (mwTitle && mwTitle.getNamespaceId() > 0 && mwTitle.getNamespaceId() % 2 === 1) {
        messageName = action === "watch" ? "addedwatchtext-talk" : "removedwatchtext-talk";
    } else {
        messageName = action === "watch" ? "addedwatchtext" : "removedwatchtext";
    }
    await Promise.all([
        getMwApi().postWithToken("watch", reqData),
        // mw.loader.using(["mediawiki.jqueryMsg"]),
        getMwApi().loadMessagesIfMissing([messageName]),
    ]);
    mw.notify(mw.message(messageName, title ?? "").parseDom() as unknown as JQuery);
};
export const magicHistoryLink = (l: LinkSpec): string | null => {
    let title = "",
        onClick = "";
    switch (l.id) {
        case "lastContrib":
            onClick = simplePrintf("pg.fn.getLastContrib('%s',%s)", [l.article.toString(true).split("\\").join("\\\\").split("'").join("\\'"), l.newWin]);
            title = popupString("lastContribHint");
            break;
        case "sinceMe":
            onClick = simplePrintf("pg.fn.getDiffSinceMyEdit('%s',%s)", [l.article.toString(true).split("\\").join("\\\\").split("'").join("\\'"), l.newWin]);
            title = popupString("sinceMeHint");
            break;
    }
    const jsUrl = `javascript:${onClick}`;
    onClick += ";return false;";
    return generalNavLink({
        url: jsUrl,
        newWin: false,
        title: title,
        text: l.text,
        noPopup: l.noPopup,
        onclick: onClick,
    });
};
export const popupMenuLink = (l: LinkSpec): string | null => {
    const jsUrl = simplePrintf("javascript:pg.fn.%s()", [l.id]);
    const title = popupString(simplePrintf("%sHint", [l.id]));
    const onClick = simplePrintf("pg.fn.%s();return false;", [l.id]);
    return generalNavLink({
        url: jsUrl,
        newWin: false,
        title: title,
        text: l.text,
        noPopup: l.noPopup,
        onclick: onClick,
    });
};
export const specialLink = (l: LinkSpec): string | null => {
    if (typeof l.specialpage === "undefined" || !l.specialpage) {
        return null;
    }
    const base = `${pg.wiki.titlebase + mw.config.get("wgFormattedNamespaces")[pg.nsSpecialId ?? -1]}:${l.specialpage}`;
    if (typeof l.sep === "undefined" || l.sep === null) {
        l.sep = "&target=";
    }
    let article = l.article.urlString({
        keepSpaces: l.specialpage === "Search",
    });
    let hint = popupString(`${l.specialpage}Hint`);
    switch (l.specialpage) {
        case "Log":
            switch (l.sep) {
                case "&user=":
                    hint = popupString("userLogHint");
                    break;
                case "&type=block&page=":
                    hint = popupString("blockLogHint");
                    break;
                case "&page=":
                    hint = popupString("pageLogHint");
                    break;
                case "&type=protect&page=":
                    hint = popupString("protectLogHint");
                    break;
                case "&type=delete&page=":
                    hint = popupString("deleteLogHint");
                    break;
                default:
                    log(`Unknown log type, sep=${l.sep}`);
                    hint = "Missing hint (FIXME)";
            }
            break;
        case "PrefixIndex":
            article += "/";
            break;
    }
    if (hint) {
        hint = simplePrintf(hint, [safeDecodeURI(l.article)]);
    } else {
        hint = safeDecodeURI(`${l.specialpage}:${String(l.article)}`) as string;
    }
    const url = base + l.sep + article;
    return generalNavLink({
        url: url,
        title: hint,
        text: l.text,
        newWin: l.newWin,
        noPopup: l.noPopup,
    });
};
export const generalLink = (link: GeneralLinkSpec): string | null => {
    if (typeof link.url === "undefined") {
        return null;
    }
    const elem = document.createElement("a");
    elem.href = link.url;
    elem.title = String(link.title);
    elem.setAttribute("onclick", String(link.onclick));
    if (link.noPopup) {
        elem.setAttribute("noPopup", "1");
    }
    let newWin;
    if (typeof link.newWin === "undefined" || link.newWin === null) {
        newWin = getValueOf("popupNewWindows");
    } else {
        newWin = link.newWin;
    }
    if (newWin) {
        elem.target = "_blank";
    }
    if (link.className) {
        elem.className = link.className;
    }
    elem.innerText = pg.unescapeQuotesHTML?.(String(link.text)) ?? "";
    return elem.outerHTML;
};
const appendParamsToLink = (linkstr: string | null, params: string): string | null => {
    if (!linkstr) {
        return null;
    }
    const sp = linkstr.parenSplit(/(href="[^"]+?)"/i);
    if (sp.length < 2) {
        return null;
    }
    let ret = (sp.shift() ?? "") + (sp.shift() ?? "");
    ret += `&${params}"`;
    ret += sp.join("");
    return ret;
};
export const changeLinkTargetLink = (x: {
    newTarget?: string | null;
    oldTarget: string;
    title?: string | null;
    newWin?: boolean | null;
    text: string;
    hint?: string | null;
    clickButton: string | number | boolean;
    minor?: boolean | null;
    watch?: boolean | string | null;
    alsoChangeLabel?: boolean;
    summary: string;
}): string | null => {
    if (x.newTarget) {
        log(`changeLinkTargetLink: newTarget=${x.newTarget}`);
    }
    if (x.oldTarget !== decodeURIComponent(x.oldTarget)) {
        log(`This might be an input problem: ${x.oldTarget}`);
    }
    const cA = mw.util.escapeRegExp(x.oldTarget);
    let chs = cA.charAt(0).toUpperCase();
    chs = `[${chs}${chs.toLowerCase()}]`;
    let currentArticleRegexBit = chs + cA.substring(1);
    currentArticleRegexBit = currentArticleRegexBit.split(/(?:[_ ]+|%20)/g).join("(?:[_ ]+|%20)").split("\\(").join("(?:%28|\\()").split("\\)").join("(?:%29|\\))");
    currentArticleRegexBit = `\\s*(${currentArticleRegexBit}(?:#[^\\[\\|]*)?)\\s*`;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string is a meaningful value here; the || branch is deliberate upstream behavior
    const title = x.title || mw.config.get("wgPageName").split("_").join(" ");
    const lk = titledWikiLink({
        article: new Title(title),
        newWin: x.newWin,
        action: "edit",
        text: x.text,
        title: x.hint,
        className: "popup_change_title_link",
    });
    let cmd = "";
    if (x.newTarget) {
        const t = x.newTarget;
        const s = mw.util.escapeRegExp(x.newTarget);
        if (x.alsoChangeLabel) {
            cmd += `s~\\[\\[${currentArticleRegexBit}\\]\\]~[[${t}]]~g;`;
            cmd += `s~\\[\\[${currentArticleRegexBit}[|]~[[${t}|~g;`;
            cmd += `s~\\[\\[${s}\\|${s}\\]\\]~[[${t}]]~g`;
        } else {
            cmd += `s~\\[\\[${currentArticleRegexBit}\\]\\]~[[${t}|$1]]~g;`;
            cmd += `s~\\[\\[${currentArticleRegexBit}[|]~[[${t}|~g;`;
            cmd += `s~\\[\\[${s}\\|${s}\\]\\]~[[${t}]]~g`;
        }
    } else {
        cmd += `s~\\[\\[${currentArticleRegexBit}\\]\\]~$1~g;`;
        cmd += `s~\\[\\[${currentArticleRegexBit}[|](.*?)\\]\\]~$2~g`;
    }
    cmd = `autoedit=${encodeURIComponent(cmd)}`;
    cmd += `&autoclick=${encodeURIComponent(x.clickButton)}&actoken=${encodeURIComponent(autoClickToken())}`;
    cmd += x.minor === null ? "" : `&autominor=${encodeURIComponent(String(x.minor))}`;
    cmd += x.watch === null ? "" : `&autowatch=${encodeURIComponent(String(x.watch))}`;
    cmd += `&autosummary=${encodeURIComponent(x.summary)}`;
    cmd += `&autoimpl=${encodeURIComponent(popupString("autoedit_version"))}`;
    return appendParamsToLink(lk, cmd);
};
export const redirLink = (redirMatch: string | Title, article: Title): string => {
    let ret = "";
    if (getValueOf("popupAppendRedirNavLinks") && getValueOf("popupNavLinks")) {
        ret += "<hr />";
        if (getValueOf("popupFixRedirs")) {
            ret += popupString("Redirects to: (Fix ");
            log(`redirLink: newTarget=${String(redirMatch)}`);
            ret += String(addPopupShortcut(changeLinkTargetLink({
                newTarget: redirMatch as string,
                text: popupString("target"),
                hint: popupString("Fix this redirect, changing just the link target"),
                summary: simplePrintf((getValueOf("popupFixRedirsSummary") as string), [article.toString(), redirMatch]),
                oldTarget: article.toString(),
                clickButton: (getValueOf("popupRedirAutoClick") as string),
                minor: true,
                watch: getValueOf("popupWatchRedirredPages") as boolean | null,
            }), "R"));
            ret += popupString(" or ");
            ret += String(addPopupShortcut(changeLinkTargetLink({
                newTarget: redirMatch as string,
                text: popupString("target & label"),
                hint: popupString("Fix this redirect, changing the link target and label"),
                summary: simplePrintf((getValueOf("popupFixRedirsSummary") as string), [article.toString(), redirMatch]),
                oldTarget: article.toString(),
                clickButton: (getValueOf("popupRedirAutoClick") as string),
                minor: true,
                watch: getValueOf("popupWatchRedirredPages") as boolean | null,
                alsoChangeLabel: true,
            }), "R"));
            ret += popupString(")");
        } else {
            ret += popupString("Redirects") + popupString(" to ");
        }
        return ret;
    }
    return `<br> ${popupString("Redirects")}${popupString(" to ")}${String(titledWikiLink({
        article: new Title().fromWikiText(redirMatch),
        action: "view",
        text: safeDecodeURI(redirMatch) as string,
        title: popupString("Bypass redirect"),
    }))}`;
};
export const arinLink = (l: LinkSpec): string | null => {
    if (!saneLinkCheck(l)) {
        return null;
    }
    if (!l.article.isIpUser() || !pg.wiki.wikimedia) {
        return null;
    }
    const uN = l.article.userName();
    return generalNavLink({
        url: `http://ws.arin.net/cgi-bin/whois.pl?queryinput=${encodeURIComponent(String(uN))}`,
        newWin: l.newWin,
        title: tprintf("Look up %s in ARIN whois database", [uN]),
        text: l.text,
        noPopup: 1,
    });
};
const toolDbName = (cookieStyle?: boolean) => {
    let ret = mw.config.get("wgDBname");
    if (!cookieStyle) {
        ret += "_p";
    }
    return ret;
};
const saneLinkCheck = (l: { article?: unknown; text?: unknown }) => {
    if (typeof l.article !== typeof {} || typeof l.text !== typeof "") {
        return false;
    }
    return true;
};
export const editCounterLink = (l: LinkSpec): string | null => {
    if (!saneLinkCheck(l)) {
        return null;
    }
    if (!pg.wiki.wikimedia) {
        return null;
    }
    const uN = l.article.userName();
    const tool = getValueOf("popupEditCounterTool");
    let url;
    const defaultToolUrl = `https://xtools.wmflabs.org/ec?user=$1&project=$2.$3&uselang=${mw.config.get("wgUserLanguage")}`;
    switch (tool) {
        case "custom":
            url = simplePrintf((getValueOf("popupEditCounterUrl") as string), [encodeURIComponent(String(uN)), toolDbName()]);
            break;
        case "soxred":
        case "kate":
        case "interiot":
        case "supercount":
        default: {
            const theWiki = pg.wiki.hostname.split(".");
            url = simplePrintf(defaultToolUrl, [encodeURIComponent(String(uN)), theWiki[0], theWiki[1]]);
        }
    }
    return generalNavLink({
        url: url,
        title: tprintf("editCounterLinkHint", [uN]),
        newWin: l.newWin,
        text: l.text,
        noPopup: 1,
    });
};
export const globalSearchLink = (l: LinkSpec): string | null => {
    if (!saneLinkCheck(l)) {
        return null;
    }
    const base = `https://global-search.toolforge.org/?uselang=${mw.config.get("wgUserLanguage")}&q=`;
    const article = l.article.urlString({
        keepSpaces: true,
    });
    return generalNavLink({
        url: base + article,
        newWin: l.newWin,
        title: tprintf("globalSearchHint", [safeDecodeURI(l.article)]),
        text: l.text,
        noPopup: 1,
    });
};
export const googleLink = (l: LinkSpec): string | null => {
    if (!saneLinkCheck(l)) {
        return null;
    }
    const base = "https://www.google.com/search?q=";
    const article = l.article.urlString({
        keepSpaces: true,
    });
    return generalNavLink({
        url: `${base}%22${article}%22`,
        newWin: l.newWin,
        title: tprintf("googleSearchHint", [safeDecodeURI(l.article)]),
        text: l.text,
        noPopup: 1,
    });
};
export const editorListLink = (l: LinkSpec): string | null => {
    if (!saneLinkCheck(l)) {
        return null;
    }
    const article = l.article.articleFromTalkPage() ?? l.article;
    const url = `https://xtools.wmflabs.org/articleinfo/${encodeURI(pg.wiki.hostname)}/${article.urlString()}?uselang=${mw.config.get("wgUserLanguage")}`;
    return generalNavLink({
        url: url,
        title: tprintf("editorListHint", [article]),
        newWin: l.newWin,
        text: l.text,
        noPopup: 1,
    });
};
const generalNavLink = (l: GeneralLinkSpec): string | null => {
    l.className = l.className === null ? "popupNavLink" : l.className;
    return generalLink(l);
};
const getHistoryInfo = (wikipage: string, whatNext?: (x: HistoryInfo) => void) => {
    log("getHistoryInfo");
    getHistory(wikipage, whatNext
        ? (d) => {
            whatNext(processHistory(d));
        }
        : processHistory);
};
const getHistory = (wikipage: string, onComplete: (d: Downloader) => void): Downloader | string => {
    log("getHistory");
    const url = `${pg.wiki.apiwikibase}?format=json&formatversion=2&action=query&prop=revisions&titles=${new Title(wikipage).urlString()}&rvlimit=${getValueOf("popupHistoryLimit") as string}`;
    log(`getHistory: url=${url}`);
    return startDownload(url, `${pg.idNumber}history`, onComplete);
};
const processHistory = (download: Downloader): HistoryInfo => {
    const jsobj = getJsObj(download.data ?? "") as { query?: { pages?: Record<string, { revisions?: HistoryEdit[] }> } };
    try {
        const page = anyChild(jsobj.query?.pages ?? {}) as { revisions?: { revid?: number; user?: string }[] } | null;
        const revisions = page?.revisions;
        if (!revisions) {
            log("Something went wrong with JSON business");
            return finishProcessHistory([], mw.config.get("wgUserName"));
        }
        const edits: HistoryEdit[] = [];
        for (const revision of revisions) {
            edits.push({
                oldid: revision.revid,
                editor: revision.user,
            });
        }
        log(`processed ${edits.length} edits`);
        return finishProcessHistory(edits, mw.config.get("wgUserName"));
    } catch {
        log("Something went wrong with JSON business");
        return finishProcessHistory([], mw.config.get("wgUserName"));
    }
};
const finishProcessHistory = (edits: HistoryEdit[], userName: string | null): HistoryInfo => {
    const histInfo: HistoryInfo = {
        edits: edits,
        userName: userName,
    };
    for (let i = 0; i < edits.length; ++i) {
        if (typeof histInfo.myLastEdit === "undefined" && userName && edits[i].editor === userName) {
            histInfo.myLastEdit = {
                index: i,
                oldid: edits[i].oldid,
                previd: i === 0 ? null : edits[i - 1].oldid,
            };
        }
        if (typeof histInfo.firstNewEditor === "undefined" && edits[i].editor !== edits[0].editor) {
            histInfo.firstNewEditor = {
                index: i,
                oldid: edits[i].oldid,
                previd: i === 0 ? null : edits[i - 1].oldid,
            };
        }
    }
    return histInfo;
};
