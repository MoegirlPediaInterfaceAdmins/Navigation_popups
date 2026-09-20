// 导航链接域：popup 导航条的 HTML <a> 构造器（wikiLink/titledWikiLink/
// generalLink/changeLinkTargetLink/redirLink 等）。行为基准 = legacy
// src/modules/links.ts 的链接构造段（commit 02c8dec，批 C-L 先头件范围）；
// getLastContrib/getDiffSinceMyEdit/getHistoryInfo/getHistory/processHistory/
// finishProcessHistory 等 history 查询与 arin/editCounter 等统计链接属后续
// 批次，不在本文件。
//
// 与 legacy 的结构差异（均为既定适配，无用户可见行为差异）：
// - pg.wiki.titlebase → title 域导出的 wiki.titlebase；
//   pg.misc.defaultNavlinkClassname → wiki.misc.defaultNavlinkClassname
//   （legacy 全仓从未赋值，恒 undefined，照搬——见 title.ts 的字段声明）
// - pg.current.link → events 域的 eventsState.current.link
// - pg.unescapeQuotesHTML → tools 域的 unescapeQuotesHTML（模块静态导入恒有
//   定义，legacy 的 ?. 可选链与 ?? "" 兜底随挂载点消失而退化，无行为差异）
// - String.prototype.parenSplit → title 域导出的 parenSplit(str, re)
// - legacy 模板串内直接内插可空表达式的位置（${l.oldid} 等）以 String()
//   显式包裹：插值语义与 ToString 相同，纯 lint 适配（已被 typeof/真值守卫
//   收窄为 string 的位置保持 legacy 原样的裸内插）
import { autoClickToken } from "../actions/autoedit.ts";
import { eventsState } from "../core/events.ts";
import { errlog, log } from "../core/log.ts";
import { getValueOf } from "../core/options.ts";
import { addPopupShortcut } from "../core/shortcutkeys.ts";
import { popupString, simplePrintf, tprintf } from "../core/strings.ts";
import { assume, unescapeQuotesHTML } from "../core/tools.ts";
import { Title, parenSplit, parseParams, safeDecodeURI, wiki } from "../title/title.ts";

// A navlink spec as built by navlinks.ts: an article plus the display
// and target options of one popup navlink. Fields are optional because
// different builders consume different subsets. Members widened with
// `| undefined` are explicitly assigned undefined by pass-through
// call sites (exactOptionalPropertyTypes distinguishes the two).
export interface LinkSpec {
    article: Title;
    action?: string | undefined;
    actionName?: string;
    text?: string | undefined;
    newWin?: boolean | null | undefined;
    title?: string | null | undefined;
    oldid?: string | null | undefined;
    noPopup?: boolean | number | null | undefined;
    onclick?: string | undefined;
    className?: string | null | undefined;
    id?: string;
    specialpage?: string;
    sep?: string | null;
    rcid?: string;
    diff?: string | null;
    from?: string | number | null;
    to?: string | null | undefined;
}
// the subset generalLink/generalNavLink actually consume (no article)
export interface GeneralLinkSpec {
    url: string;
    newWin?: boolean | null | undefined;
    title?: string | null;
    text?: string | null | undefined;
    className?: string | null | undefined;
    noPopup?: boolean | number | null | undefined;
    onclick?: string | undefined;
}
export const wikiLink = (l: LinkSpec): string | null => {
    if (!(typeof l.article === typeof {} && typeof l.action === typeof "" && typeof l.text === typeof "")) {
        return null;
    }
    if (typeof l.oldid === "undefined") {
        l.oldid = null;
    }
    const savedOldid = l.oldid;
    // 非 edit|view|revert|render|^raw 动作下 oldid 无意义，置空丢弃（legacy 原样）
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
            const p = parseParams(eventsState.current.link?.href ?? "");
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
    // istanbul ignore else -- popupString 三级兜底最终返回键名本身，hint 恒为
    // 真值，else 回退分支结构性不可达；按行为基准纪律逐字照搬勿修
    if (hint) {
        if (l.oldid) {
            hint = simplePrintf(hint, [revisionString]);
        } else {
            hint = simplePrintf(hint, [safeDecodeURI(l.article)]);
        }
    } else {
        // 照搬勿修：+ 优先级高于三元，条件实为两侧拼接串的真值（恒取真分支），
        // legacy 上游笔误原样保留
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
    const base = wiki.titlebase + l.article.urlString();
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
    let cssClass: string | null | undefined = wiki.misc.defaultNavlinkClassname;
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
export const generalLink = (link: GeneralLinkSpec): string | null => {
    if (typeof link.url === "undefined") {
        return null;
    }
    const elem = document.createElement("a");
    elem.href = link.url;
    // title/onclick 缺省时 String() 产出字面 "undefined"/"null" 属性值——legacy
    // 原样（getAttribute 恒可读到哨兵串），照搬勿修
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
    elem.innerText = unescapeQuotesHTML(String(link.text));
    return elem.outerHTML;
};
// legacy 未导出（links.ts 模块内部使用）；重写版导出仅为单测直调覆盖其
// 「无 href 命中返 null」分支（exported API 下结构性不可达），运行时行为不变
export const appendParamsToLink = (linkstr: string | null, params: string): string | null => {
    if (!linkstr) {
        return null;
    }
    const sp = parenSplit(linkstr, /(href="[^"]+?)"/i);
    if (sp.length < 2) {
        return null;
    }
    // istanbul ignore next -- split 产物为稠密字符串数组（长度已 >= 2），两次
    // shift 必非空，?? "" 兜底结构性不可达，照搬 legacy
    let ret = (sp.shift() ?? "") + (sp.shift() ?? "");
    ret += `&${params}"`;
    ret += sp.join("");
    return ret;
};
export const changeLinkTargetLink = (x: {
    newTarget?: string | null;
    oldTarget: string;
    title?: string | null | undefined;
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
// generalNavLink：className 为 null 时回落 popupNavLink——undefined 不命中该
// 分支（=== null 严格比较），照搬勿修
// legacy 未导出（links.ts 模块内部使用）；重写版导出仅为单测直调覆盖该回落
// 分支（现行调用链只传 string | undefined），运行时行为不变
export const generalNavLink = (l: GeneralLinkSpec): string | null => {
    l.className = l.className === null ? "popupNavLink" : l.className;
    return generalLink(l);
};
