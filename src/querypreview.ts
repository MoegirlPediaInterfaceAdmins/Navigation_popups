import { completedNavpopTask, insertPreview, pendingNavpopTask, prepPreviewmaker } from "./actions.ts";
import type { Downloader } from "./downloader.ts";
import { getPageWithCaching } from "./getpage.ts";
import { errlog, log, pg } from "./globals.ts";
import { setPopupHTML, setPopupTipsAndHTML, setPopupTrailer } from "./htmloutput.ts";
import { getMwApi } from "./init.ts";
import { wikiLink } from "./links.ts";
import type { Navpopup } from "./navpopup.ts";
import { getValueOf } from "./options.ts";
import { getPageInfo } from "./pageinfo.ts";
import { Previewmaker } from "./previewmaker.ts";
import { popupString, tprintf } from "./strings.ts";
import { Title } from "./titles.ts";
import { anyChild, getJsObj, map, zeroFill } from "./tools.ts";
// one page entry of an action=query&prop=revisions response
interface RevisionPage {
    missing?: boolean | string;
    title?: string;
    revisions?: {
        revid?: number;
        title?: string;
        timestamp?: string;
        user?: string;
        comment?: string;
        minor?: boolean | string;
        userhidden?: boolean;
        commenthidden?: boolean;
        slots?: { main?: { content?: string; contentmodel?: string } };
    }[];
    pageprops?: { wikibase_item?: string };
    imagerepository?: string;
    [key: string]: unknown;
}
type RevisionRow = NonNullable<RevisionPage["revisions"]>[number];
interface RevisionQuery {
    query?: {
        pages?: Record<string, RevisionPage>;
        wikibase?: { repo?: { url?: { base?: string; articlepath?: string } } };
        backlinks?: { title: string }[];
        imageusage?: { title: string }[];
        categorymembers?: { title: string }[];
        usercontribs?: RevisionRow[];
        users?: Record<string, UserInfoEntry>;
        globaluserinfo?: { groups?: string[]; unattached?: { wiki?: string }[]; [key: string]: unknown };
        blocks?: { rangestart?: string; rangeend?: string; restrictions?: unknown }[];
    };
    "continue"?: Record<string, string>;
}
interface UserInfoEntry {
    groups?: string[];
    gender?: string;
    editcount?: number;
    registration?: string;
    invalid?: string;
    missing?: string;
    blockedby?: string;
    blockpartial?: boolean;
    [key: string]: unknown;
}
type APIPreviewFn = (article: Title, download: Downloader, navpop: Navpopup) => string | undefined;
export const loadAPIPreview = (queryType: string, article: Title, navpop: Navpopup) => {
    const art = new Title(article).urlString();
    let url = `${pg.wiki.apiwikibase}?format=json&formatversion=2&action=query&`;
    let htmlGenerator: APIPreviewFn = () => {
        alert("invalid html generator");
        return undefined;
    };
    let usernameart;
    switch (queryType) {
        case "history":
            url += `titles=${art}&prop=revisions&rvlimit=${getValueOf("popupHistoryPreviewLimit")}`;
            htmlGenerator = APIhistoryPreviewHTML;
            break;
        case "category":
            url += `list=categorymembers&cmtitle=${art}`;
            htmlGenerator = APIcategoryPreviewHTML;
            break;
        case "userinfo": {
            const username = new Title(article).userName();
            usernameart = encodeURIComponent(String(username));
            if ((pg.re.ipUser as RegExp).test(String(username))) {
                url += `list=blocks&bkprop=range|restrictions&bkip=${usernameart}`;
            } else {
                url += `list=users|usercontribs&usprop=blockinfo|groups|editcount|registration|gender&ususers=${usernameart}&meta=globaluserinfo&guiprop=groups|unattached&guiuser=${usernameart}&uclimit=1&ucprop=timestamp&ucuser=${usernameart}`;
            }
            htmlGenerator = APIuserInfoPreviewHTML;
            break;
        }
        case "contribs":
            usernameart = encodeURIComponent(String(new Title(article).userName()));
            url += `list=usercontribs&ucuser=${usernameart}&uclimit=${getValueOf("popupContribsPreviewLimit")}`;
            htmlGenerator = APIcontribsPreviewHTML;
            break;
        case "imagepagepreview": {
            let trail = "";
            if (getValueOf("popupImageLinks")) {
                trail = `&list=imageusage&iutitle=${art}`;
            }
            url += `titles=${art}&prop=revisions|imageinfo&rvslots=main&rvprop=content${trail}`;
            htmlGenerator = APIimagepagePreviewHTML;
            break;
        }
        case "backlinks":
            url += `list=backlinks&bltitle=${art}`;
            htmlGenerator = APIbacklinksPreviewHTML;
            break;
        case "revision":
            if (article.oldid) {
                url += `revids=${article.oldid}`;
            } else {
                url += `titles=${article.removeAnchor().urlString()}`;
            }
            url += "&prop=revisions|pageprops|info|images|categories&meta=wikibase&rvslots=main&rvprop=ids|timestamp|flags|comment|user|content&cllimit=max&imlimit=max";
            htmlGenerator = APIrevisionPreviewHTML;
            break;
    }
    pendingNavpopTask(navpop);
    const callback = async (d: Downloader) => {
        log("callback of API functions was hit");
        if (queryType === "userinfo") {
            await fetchUserGroupNames(d.data);
            showAPIPreview(queryType, htmlGenerator(article, d, navpop), navpop.idNumber, navpop, d);
            return;
        }
        showAPIPreview(queryType, htmlGenerator(article, d, navpop), navpop.idNumber, navpop, d);
    };
    const go = () => {
        getPageWithCaching(url, callback, navpop);
        return true;
    };
    if (navpop.visible || !getValueOf("popupLazyDownloads")) {
        go();
    } else {
        navpop.addHook(go, "unhide", "before", `DOWNLOAD_${queryType}_QUERY_DATA`);
    }
};
const linkList = (list: string[]) => {
    list.sort((x, y) => x === y ? 0 : x < y ? -1 : 1);
    const buf: (string | null)[] = [];
    for (let i = 0; i < list.length; ++i) {
        buf.push(wikiLink({
            article: new Title(list[i]),
            text: list[i].split(" ").join("&nbsp;"),
            action: "view",
        }));
    }
    return buf.join(popupString("separator"));
};
const getTimeOffset = () => {
    const tz = mw.user.options.get("timecorrection");
    if (tz) {
        if (tz.indexOf("|") > -1) {
            return parseInt(tz.split("|")[1], 10);
        }
    }
    return 0;
};
const getTimeZone = () => {
    if (!pg.user.timeZone) {
        const tz = mw.user.options.get("timecorrection");
        pg.user.timeZone = "UTC";
        if (tz) {
            const tzComponents = tz.split("|");
            if (tzComponents.length === 3 && tzComponents[0] === "ZoneInfo") {
                pg.user.timeZone = tzComponents[2];
            } else {
                errlog(`Unexpected timezone information: ${tz}`);
            }
        }
    }
    return pg.user.timeZone;
};
const useTimeOffset = () => {
    if (typeof (Intl.DateTimeFormat.prototype as unknown as Record<string, unknown>).formatToParts === "undefined") {
        return true;
    }
    const tz = mw.user.options.get("timecorrection");
    if (tz && tz.indexOf("ZoneInfo|") === -1) {
        return true;
    }
    return false;
};
const getLocales = () => {
    if (!pg.user.locales) {
        let userLanguage: string | null = document.querySelector("html")?.getAttribute("lang") ?? null;
        if (getValueOf("popupLocale")) {
            userLanguage = String(getValueOf("popupLocale"));
        } else if (userLanguage === "en") {
            if (getMWDateFormat() === "mdy") {
                userLanguage = "en-US";
            } else {
                userLanguage = "en-GB";
            }
        }
        pg.user.locales = Intl.DateTimeFormat.supportedLocalesOf([userLanguage ?? "", navigator.language]);
    }
    return pg.user.locales;
};
const getMWDateFormat = () => mw.user.options.get("date");
const editPreviewTable = (article: Title, h: RevisionRow[], reallyContribs?: boolean) => {
    let html = ["<table>"];
    let day: string | null = null;
    let curart: Title | string = article;
    let page: string | null = null;
    let makeFirstColumnLinks: (currentRevision: RevisionRow) => string;
    if (reallyContribs) {
        makeFirstColumnLinks = (currentRevision) => {
            let result = "(";
            result += `<a href="${pg.wiki.titlebase}${new Title(currentRevision.title ?? "").urlString()}&diff=prev&oldid=${currentRevision.revid}">${popupString("diff")}</a>`;
            result += "&nbsp;|&nbsp;";
            result += `<a href="${pg.wiki.titlebase}${new Title(currentRevision.title ?? "").urlString()}&action=history">${popupString("hist")}</a>`;
            result += ")";
            return result;
        };
    } else {
        const firstRevid = h[0].revid;
        makeFirstColumnLinks = (currentRevision) => {
            let result = "(";
            result += `<a href="${pg.wiki.titlebase}${new Title(curart).urlString()}&diff=${firstRevid}&oldid=${currentRevision.revid}">${popupString("cur")}</a>`;
            result += "&nbsp;|&nbsp;";
            result += `<a href="${pg.wiki.titlebase}${new Title(curart).urlString()}&diff=prev&oldid=${currentRevision.revid}">${popupString("last")}</a>`;
            result += ")";
            return result;
        };
    }
    for (let i = 0; i < h.length; ++i) {
        if (reallyContribs) {
            page = h[i].title ?? null;
            curart = new Title(page);
        }
        const minor = h[i].minor ? "<b>小 </b>" : "";
        const editDate = new Date(h[i].timestamp ?? "");
        let thisDay = formattedDate(editDate);
        const thisTime = formattedTime(editDate);
        if (thisDay === day) {
            thisDay = "";
        } else {
            day = thisDay;
        }
        if (thisDay) {
            html.push(`<tr><td colspan=3><span class="popup_history_date">${thisDay}</span></td></tr>`);
        }
        html.push(`<tr class="popup_history_row_${i % 2 ? "odd" : "even"}">`);
        html.push(`<td>${makeFirstColumnLinks(h[i])}</td>`);
        html.push(`<td><a href="${pg.wiki.titlebase}${new Title(curart).urlString()}&oldid=${h[i].revid}">${thisTime}</a></td>`);
        let col3url: string,
            col3txt: string;
        if (!reallyContribs) {
            const user = h[i].user;
            if (!h[i].userhidden) {
                if ((pg.re.ipUser as RegExp).test(String(user))) {
                    col3url = `${pg.wiki.titlebase + mw.config.get("wgFormattedNamespaces")[pg.nsSpecialId ?? -1]}:Contributions&target=${new Title(user ?? "").urlString()}`;
                } else {
                    col3url = `${pg.wiki.titlebase + mw.config.get("wgFormattedNamespaces")[pg.nsUserId ?? -1]}:${new Title(user ?? "").urlString()}`;
                }
                col3txt = pg.escapeQuotesHTML?.(user ?? "") ?? "";
            } else {
                col3url = String(getValueOf("popupRevDelUrl"));
                col3txt = pg.escapeQuotesHTML?.(popupString("revdel")) ?? "";
            }
        } else {
            col3url = pg.wiki.titlebase + curart.urlString();
            col3txt = pg.escapeQuotesHTML?.(page ?? "") ?? "";
        }
        html.push(`<td>${reallyContribs ? minor : ""}<a href="${col3url}">${col3txt}</a></td>`);
        let comment = "";
        const c = h[i].comment || (typeof h[i].slots !== "undefined" ? h[i].slots?.main?.content ?? null : null);
        if (c) {
            comment = new Previewmaker(c, new Title(curart).toUrl()).editSummaryPreview();
        } else if (h[i].commenthidden) {
            comment = popupString("revdel");
        }
        html.push(`<td>${!reallyContribs ? minor : ""}${comment}</td>`);
        html.push("</tr>");
        html = [html.join("")];
    }
    html.push("</table>");
    return html.join("");
};
const adjustDate = (d: Date, offset: number) => {
    const o = offset * 60 * 1e3;
    return new Date(+d + o);
};
const convertTimeZone = (date: Date, timeZone: string | undefined) => new Date(date.toLocaleString("en-US", {
    timeZone: timeZone,
}));
export const formattedDateTime = (date: Date) => {
    if (useTimeOffset()) {
        return `${formattedDate(date)} ${formattedTime(date)}`;
    }
    if (getMWDateFormat() === "ISO 8601") {
        const d2 = convertTimeZone(date, getTimeZone());
        return `${map(zeroFill, [d2.getFullYear(), d2.getMonth() + 1, d2.getDate()]).join("-")}T${map(zeroFill, [d2.getHours(), d2.getMinutes(), d2.getSeconds()]).join(":")}`;
    }
    const options = getValueOf("popupDateTimeFormatterOptions") as Intl.DateTimeFormatOptions;
    options.timeZone = getTimeZone();
    return date.toLocaleString(getLocales(), options);
};
const formattedDate = (date: Date) => {
    if (useTimeOffset()) {
        const d2 = adjustDate(date, getTimeOffset());
        return map(zeroFill, [d2.getUTCFullYear(), d2.getUTCMonth() + 1, d2.getUTCDate()]).join("-");
    }
    if (getMWDateFormat() === "ISO 8601") {
        const d2 = convertTimeZone(date, getTimeZone());
        return map(zeroFill, [d2.getFullYear(), d2.getMonth() + 1, d2.getDate()]).join("-");
    }
    const options = getValueOf("popupDateFormatterOptions") as Intl.DateTimeFormatOptions;
    options.timeZone = getTimeZone();
    return date.toLocaleDateString(getLocales(), options);
};
const formattedTime = (date: Date) => {
    if (useTimeOffset()) {
        const d2 = adjustDate(date, getTimeOffset());
        return map(zeroFill, [d2.getUTCHours(), d2.getUTCMinutes(), d2.getUTCSeconds()]).join(":");
    }
    if (getMWDateFormat() === "ISO 8601") {
        const d2 = convertTimeZone(date, getTimeZone());
        return map(zeroFill, [d2.getHours(), d2.getMinutes(), d2.getSeconds()]).join(":");
    }
    const options = getValueOf("popupTimeFormatterOptions") as Intl.DateTimeFormatOptions;
    options.timeZone = getTimeZone();
    return date.toLocaleTimeString(getLocales(), options);
};
const fetchUserGroupNames = (userinfoResponse: string | undefined) => {
    const queryObj = getJsObj<RevisionQuery>(userinfoResponse ?? "") as RevisionQuery;
    const user = anyChild(queryObj.query?.users ?? {});
    const messages: string[] = [];
    if (user?.groups) {
        user.groups.forEach((groupName: string) => {
            messages.push(`group-${groupName}-member`);
        });
    }
    if (queryObj.query?.globaluserinfo?.groups) {
        queryObj.query.globaluserinfo.groups.forEach((groupName: string) => {
            messages.push(`group-${groupName}-member`);
        });
    }
    return getMwApi().loadMessagesIfMissing(messages);
};
const showAPIPreview = (queryType: string, html: string | null | undefined, id: number | undefined, navpop: Navpopup, download?: Downloader) => {
    let target = "popupPreview";
    completedNavpopTask(navpop);
    switch (queryType) {
        case "imagelinks":
        case "category":
            target = "popupPostPreview";
            break;
        case "userinfo":
            target = "popupUserData";
            break;
        case "revision":
            if (download) {
                insertPreview(download);
            }
            return;
    }
    setPopupTipsAndHTML(html, target, id);
};
const APIrevisionPreviewHTML = (article: Title, download: Downloader): string | undefined => {
    try {
        const jsObj = getJsObj<RevisionQuery>(download.data ?? "") as RevisionQuery;
        const q = jsObj.query;
        if (!q?.pages) {
            return "Revision preview failed :(";
        }
        const page = anyChild(q.pages);
        if (!page) {
            return "Revision preview failed :(";
        }
        if (page.missing) {
            download.owner = null;
            return;
        }
        const content = page.revisions?.[0]?.slots?.main?.contentmodel === "wikitext" ? page.revisions[0].slots.main.content : null;
        if (typeof content === "string") {
            download.data = content;
            download.lastModified = new Date(page.revisions![0].timestamp ?? "");
        }
        if (page.pageprops?.wikibase_item) {
            download.wikibaseItem = page.pageprops.wikibase_item;
            download.wikibaseRepo = `${q.wikibase?.repo?.url?.base ?? ""}${q.wikibase?.repo?.url?.articlepath ?? ""}`;
        }
    } catch {
        return "Revision preview failed :(";
    }
};
const APIbacklinksPreviewHTML = (article: Title, download: Downloader): string => {
    try {
        const jsObj = getJsObj<RevisionQuery>(download.data ?? "") as RevisionQuery;
        const q = jsObj.query;
        if (!q) {
            return "backlinksPreviewHTML went wonky";
        }
        const list = q.backlinks;
        let html: string[] | string = [];
        if (!list) {
            return popupString("No backlinks found");
        }
        for (let i = 0; i < list.length; i++) {
            const t = new Title(list[i].title);
            html.push(`<a href="${pg.wiki.titlebase}${t.urlString()}">${t.toString().entify()}</a>`);
        }
        html = html.join(popupString("separator"));
        if (jsObj.continue?.blcontinue) {
            html += popupString(" and more");
        }
        return html;
    } catch {
        return "backlinksPreviewHTML went wonky";
    }
};
pg.fn.APIsharedImagePagePreviewHTML = (obj: RevisionQuery & { requestid?: number }) => {
    log("APIsharedImagePagePreviewHTML");
    const popupid = obj.requestid;
    if (obj.query?.pages) {
        const page = anyChild(obj.query.pages);
        const content = page?.revisions?.[0]?.slots?.main?.contentmodel === "wikitext" ? page.revisions[0].slots.main.content : null;
        if (typeof content === "string" && pg?.current?.link?.navpopup) {
            const p = new Previewmaker(content, pg.current.link.navpopup.article!, pg.current.link.navpopup);
            p.makePreview();
            setPopupHTML(p.html, "popupSecondPreview", popupid);
        }
    }
};
const APIimagepagePreviewHTML = (article: Title, download: Downloader, navpop: Navpopup): string => {
    try {
        const jsObj = getJsObj<RevisionQuery>(download.data ?? "") as RevisionQuery;
        const q = jsObj.query;
        if (!q?.pages) {
            return "API imagepage preview failed :(";
        }
        const page = anyChild(q.pages);
        const content = page?.revisions?.[0]?.slots?.main?.contentmodel === "wikitext" ? page.revisions[0].slots.main.content : null;
        let ret = "";
        let alt: string | undefined = "";
        try {
            alt = (navpop.parentAnchor?.childNodes[0] as HTMLImageElement | undefined)?.alt;
        } catch { }
        if (alt) {
            ret = `${ret}<hr /><b>${popupString("Alt text:")}</b> ${pg.escapeQuotesHTML?.(alt) ?? ""}`;
        }
        if (typeof content === "string") {
            const p = prepPreviewmaker(content, article, navpop);
            p.makePreview();
            if (p.html) {
                ret += `<hr />${p.html}`;
            }
            if (getValueOf("popupSummaryData")) {
                const info = getPageInfo(content, download);
                log(info);
                setPopupTrailer(info, navpop.idNumber);
            }
        }
        if (page && page.imagerepository === "shared") {
            const art = new Title(article);
            const encart = encodeURIComponent(`File:${art.stripNamespace()}`);
            const shared_url = `${pg.wiki.apicommonsbase}?format=json&formatversion=2&callback=pg.fn.APIsharedImagePagePreviewHTML&requestid=${navpop.idNumber}&action=query&prop=revisions&rvslots=main&rvprop=content&titles=${encart}`;
            ret = `${ret}<hr />${popupString("Image from Commons")}: <a href="${pg.wiki.commonsbase}?title=${encart}">${popupString("Description page")}</a>`;
            mw.loader.load(shared_url);
        }
        showAPIPreview("imagelinks", APIimagelinksPreviewHTML(article, download), navpop.idNumber, download as unknown as Navpopup);
        return ret;
    } catch {
        return "API imagepage preview failed :(";
    }
};
const APIimagelinksPreviewHTML = (article: Title, download: Downloader): string => {
    try {
        const jsobj = getJsObj<RevisionQuery>(download.data ?? "") as RevisionQuery;
        const list = jsobj.query?.imageusage;
        if (list) {
            const ret: string[] = [];
            for (let i = 0; i < list.length; i++) {
                ret.push(list[i].title);
            }
            if (ret.length === 0) {
                return popupString("No image links found");
            }
            return `<h2>${popupString("File links")}</h2>${linkList(ret)}`;
        }
        return popupString("No image links found");
    } catch {
        return "Image links preview generation failed :(";
    }
};
const APIcategoryPreviewHTML = (article: Title, download: Downloader): string => {
    try {
        const jsobj = getJsObj<RevisionQuery>(download.data ?? "") as RevisionQuery;
        const list = jsobj.query?.categorymembers;
        let ret: string[] | string = [];
        if (!list) {
            return popupString("Empty category");
        }
        for (let p = 0; p < list.length; p++) {
            ret.push(list[p].title);
        }
        if (ret.length === 0) {
            return popupString("Empty category");
        }
        ret = `<h2>${tprintf("Category members (%s shown)", [ret.length])}</h2>${linkList(ret)}`;
        if (jsobj.continue?.cmcontinue) {
            ret += popupString(" and more");
        }
        return ret;
    } catch {
        return "Category preview failed :(";
    }
};
const APIuserInfoPreviewHTML = (article: Title, download: Downloader): string => {
    let ret: string[] | string = [];
    let queryobj: RevisionQuery;
    try {
        queryobj = getJsObj<RevisionQuery>(download.data ?? "") as RevisionQuery;
    } catch {
        return "Userinfo preview failed :(";
    }
    const user = anyChild(queryobj.query?.users ?? {});
    if (user) {
        const globaluserinfo = queryobj.query?.globaluserinfo;
        if (user.invalid === "") {
            ret.push(popupString("Invalid user"));
        } else if (user.missing === "") {
            ret.push(popupString("Not a registered username"));
        }
        if (user.blockedby) {
            if (user.blockpartial) {
                ret.push(`<b>${popupString("Has blocks")}</b>`);
            } else {
                ret.push(`<b>${popupString("BLOCKED")}</b>`);
            }
        }
        if (globaluserinfo && (Reflect.has(globaluserinfo, "locked") || Reflect.has(globaluserinfo, "hidden"))) {
            let lockedSulAccountIsAttachedToThis = true;
            for (let i = 0; globaluserinfo.unattached && i < globaluserinfo.unattached.length; i++) {
                if (globaluserinfo.unattached[i].wiki === mw.config.get("wgDBname")) {
                    lockedSulAccountIsAttachedToThis = false;
                    break;
                }
            }
            if (lockedSulAccountIsAttachedToThis) {
                if (Reflect.has(globaluserinfo, "locked")) {
                    ret.push(`<b><i>${popupString("LOCKED")}</i></b>`);
                }
                if (Reflect.has(globaluserinfo, "hidden")) {
                    ret.push(`<b><i>${popupString("HIDDEN")}</i></b>`);
                }
            }
        }
        if (getValueOf("popupShowGender") && user.gender) {
            switch (user.gender) {
                case "male":
                    ret.push(popupString("♂"));
                    break;
                case "female":
                    ret.push(popupString("♀"));
                    break;
            }
        }
        if (user.groups) {
            // 自定义
            const ug: string[] = [];
            user.groups.forEach((groupName) => {
                if (!["*", "user", "autoconfirmed"].includes(groupName)) {
                    ug.push(pg.escapeQuotesHTML?.(mw.message(`group-${groupName}-member`, user.gender ?? "").text()) ?? "");
                }
            });
            if (!user.groups.includes("autoconfirmed")) {
                ug.push(`<b>${pg.escapeQuotesHTML?.(popupString("group-no-autoconfirmed")) ?? ""}</b>`);
            }
            if (ug.length === 0) {
                ug.push(pg.escapeQuotesHTML?.(mw.message("group-user-member", user.gender ?? "").text()) ?? "");
            }
            ret.push(ug.join(popupString("separator")));
        }
        if (globaluserinfo?.groups) {
            const gug: string[] = [];
            globaluserinfo.groups.forEach((groupName) => {
                gug.push(`<i>${pg.escapeQuotesHTML?.(mw.message(`group-${groupName}-member`, user.gender ?? "").text()) ?? ""}</i>`);
            });
            ret.push(gug.join(popupString("separator")));
        }
        if (user.registration) {
            ret.push(pg.escapeQuotesHTML?.((user.editcount ? user.editcount : "0") + popupString(" edits since: ") + (user.registration ? formattedDate(new Date(user.registration)) : "")) ?? "");
        }
    }
    if (queryobj.query?.usercontribs?.length) {
        ret.push(popupString("last edit on ") + formattedDate(new Date(queryobj.query.usercontribs[0].timestamp ?? "")));
    }
    if (queryobj.query?.blocks) {
        ret.push(popupString("IP user"));
        for (let l = 0; l < queryobj.query.blocks.length; l++) {
            let rbstr = queryobj.query.blocks[l].rangestart === queryobj.query.blocks[l].rangeend ? "BLOCK" : "RANGEBLOCK";
            rbstr = !Array.isArray(queryobj.query.blocks[l].restrictions) ? `Has ${rbstr.toLowerCase()}s` : `${rbstr}ED`;
            ret.push(`<b>${popupString(rbstr)}</b>`);
        }
    }
    ret = `<hr />${ret.join(popupString("comma"))}`;
    return ret;
};
const APIcontribsPreviewHTML = (article: Title, download: Downloader, navpop: Navpopup): string => APIhistoryPreviewHTML(article, download, navpop, true);
const APIhistoryPreviewHTML = (article: Title, download: Downloader, navpop: Navpopup, reallyContribs?: boolean): string => {
    try {
        const jsobj = getJsObj<RevisionQuery>(download.data ?? "") as RevisionQuery;
        let edits: RevisionRow[] = [];
        if (reallyContribs) {
            edits = jsobj.query?.usercontribs ?? [];
        } else {
            edits = anyChild(jsobj.query?.pages ?? {})?.revisions ?? [];
        }
        const ret = editPreviewTable(article, edits, reallyContribs);
        return ret;
    } catch {
        return popupString("History preview failed");
    }
};
