import { log, pg } from "./globals.ts";
import { setPopupHTML } from "./htmloutput.ts";
import { changeLinkTargetLink } from "./links.ts";
import { getValueOf } from "./options.ts";
import { popupString, tprintf } from "./strings.ts";
import { Title, isDisambig } from "./titles.ts";
import type { Navpopup } from "./navpopup.ts";
import { simplePrintf } from "./tools.ts";
const retargetDab = (newTarget: string, oldTarget: unknown, friendlyCurrentArticleName: string, titleToEdit: string | undefined) => {
    log(`retargetDab: newTarget=${newTarget} oldTarget=${oldTarget}`);
    return changeLinkTargetLink({
        newTarget: newTarget,
        text: newTarget.split(" ").join("&nbsp;"),
        hint: tprintf("disambigHint", [newTarget]),
        summary: simplePrintf(String(getValueOf("popupFixDabsSummary")), [friendlyCurrentArticleName, newTarget]),
        clickButton: String(getValueOf("popupDabsAutoClick")),
        minor: true,
        oldTarget: oldTarget as string,
        watch: getValueOf("popupWatchDisambiggedPages") as boolean | null,
        title: titleToEdit,
    });
};
const listLinks = (wikitext: string, oldTarget: unknown, titleToEdit: string | undefined) => {
    const reg = RegExp("\\[\\[([^|]*?) *(\\||\\]\\])", "gi");
    let ret: (string | null)[] = [];
    const splitted = wikitext.parenSplit(reg);
    const omitRegex = RegExp("^[a-z]*:|^[Ss]pecial:|^[Ii]mage|^[Cc]ategory");
    const friendlyCurrentArticleName = String(oldTarget);
    const wikPos = getValueOf("popupDabWiktionary");
    for (let i = 1; i < splitted.length; i = i + 3) {
        if (typeof splitted[i] === typeof "string" && splitted[i].length > 0 && !omitRegex.test(splitted[i])) {
            ret.push(retargetDab(splitted[i], oldTarget, friendlyCurrentArticleName, titleToEdit));
        }
    }
    ret = rmDupesFromSortedList(ret.sort());
    if (wikPos) {
        const wikTarget = `wiktionary:${friendlyCurrentArticleName.replace(RegExp("^(.+)\\s+[(][^)]+[)]\\s*$"), "$1")}`;
        let meth: "unshift" | "push";
        if (String(wikPos).toLowerCase() === "first") {
            meth = "unshift";
        } else {
            meth = "push";
        }
        ret[meth](retargetDab(wikTarget, oldTarget, friendlyCurrentArticleName, titleToEdit));
    }
    ret.push(changeLinkTargetLink({
        newTarget: null,
        text: popupString("remove this link").split(" ").join("&nbsp;"),
        hint: popupString("remove all links to this disambig page from this article"),
        clickButton: String(getValueOf("popupDabsAutoClick")),
        oldTarget: oldTarget as string,
        summary: simplePrintf(String(getValueOf("popupRmDabLinkSummary")), [friendlyCurrentArticleName]),
        watch: getValueOf("popupWatchDisambiggedPages") as boolean | null,
        title: titleToEdit,
    }));
    return ret;
};
const rmDupesFromSortedList = (list: (string | null)[]) => {
    const ret: (string | null)[] = [];
    for (const item of list) {
        if (ret.length === 0 || item !== ret[ret.length - 1]) {
            ret.push(item);
        }
    }
    return ret;
};
const makeFixDab = (data: string, navpop: Navpopup) => {
    const titleToEdit = navpop.parentPopup ? String(navpop.parentPopup.article) : undefined;
    const list = listLinks(data, navpop.originalArticle, titleToEdit);
    if (list.length === 0) {
        log("listLinks returned empty list");
        return null;
    }
    let html = `<hr />${popupString("Click to disambiguate this link to:")}<br>`;
    html += list.join(popupString("separator"));
    return html;
};
export const makeFixDabs = (wikiText: string, navpop: Navpopup) => {
    if (getValueOf("popupFixDabs") && navpop.article && isDisambig(wikiText, navpop.article) && Title.fromURL(location.href).namespaceId() !== pg.nsSpecialId && navpop.article.talkPage()) {
        setPopupHTML(makeFixDab(wikiText, navpop), "popupFixDab", navpop.idNumber);
    }
};
export const popupRedlinkHTML = (article: unknown) => changeLinkTargetLink({
    newTarget: null,
    text: popupString("remove this link").split(" ").join("&nbsp;"),
    hint: popupString("remove all links to this page from this article"),
    clickButton: String(getValueOf("popupRedlinkAutoClick")),
    oldTarget: String(article),
    summary: simplePrintf(String(getValueOf("popupRedlinkSummary")), [String(article)]),
});
