// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { log, pg } from "./globals.ts";
import { setPopupHTML } from "./htmloutput.ts";
import { changeLinkTargetLink } from "./links.ts";
import { getValueOf } from "./options.ts";
import { popupString, tprintf } from "./strings.ts";
import { Title, isDisambig } from "./titles.ts";
import { simplePrintf } from "./tools.ts";
    const retargetDab = (newTarget, oldTarget, friendlyCurrentArticleName, titleToEdit) => {
        log(`retargetDab: newTarget=${newTarget} oldTarget=${oldTarget}`);
        return changeLinkTargetLink({
            newTarget: newTarget,
            text: newTarget.split(" ").join("&nbsp;"),
            hint: tprintf("disambigHint", [newTarget]),
            summary: simplePrintf(getValueOf("popupFixDabsSummary"), [friendlyCurrentArticleName, newTarget]),
            clickButton: getValueOf("popupDabsAutoClick"),
            minor: true,
            oldTarget: oldTarget,
            watch: getValueOf("popupWatchDisambiggedPages"),
            title: titleToEdit,
        });
    };
    const listLinks = (wikitext, oldTarget, titleToEdit) => {
        const reg = RegExp("\\[\\[([^|]*?) *(\\||\\]\\])", "gi");
        let ret = [];
        const splitted = wikitext.parenSplit(reg);
        const omitRegex = RegExp("^[a-z]*:|^[Ss]pecial:|^[Ii]mage|^[Cc]ategory");
        const friendlyCurrentArticleName = oldTarget.toString();
        const wikPos = getValueOf("popupDabWiktionary");
        for (let i = 1; i < splitted.length; i = i + 3) {
            if (typeof splitted[i] === typeof "string" && splitted[i].length > 0 && !omitRegex.test(splitted[i])) {
                ret.push(retargetDab(splitted[i], oldTarget, friendlyCurrentArticleName, titleToEdit));
            }
        }
        ret = rmDupesFromSortedList(ret.sort());
        if (wikPos) {
            const wikTarget = `wiktionary:${friendlyCurrentArticleName.replace(RegExp("^(.+)\\s+[(][^)]+[)]\\s*$"), "$1")}`;
            let meth;
            if (wikPos.toLowerCase() === "first") {
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
            clickButton: getValueOf("popupDabsAutoClick"),
            oldTarget: oldTarget,
            summary: simplePrintf(getValueOf("popupRmDabLinkSummary"), [friendlyCurrentArticleName]),
            watch: getValueOf("popupWatchDisambiggedPages"),
            title: titleToEdit,
        }));
        return ret;
    };
    const rmDupesFromSortedList = (list) => {
        const ret = [];
        for (let i = 0; i < list.length; ++i) {
            if (ret.length === 0 || list[i] !== ret[ret.length - 1]) {
                ret.push(list[i]);
            }
        }
        return ret;
    };
    const makeFixDab = (data, navpop) => {
        const titleToEdit = navpop.parentPopup && navpop.parentPopup.article.toString();
        const list = listLinks(data, navpop.originalArticle, titleToEdit);
        if (list.length === 0) {
            log("listLinks returned empty list");
            return null;
        }
        let html = `<hr />${popupString("Click to disambiguate this link to:")}<br>`;
        html += list.join(popupString("separator"));
        return html;
    };
    export const makeFixDabs = (wikiText, navpop) => {
        if (getValueOf("popupFixDabs") && isDisambig(wikiText, navpop.article) && Title.fromURL(location.href).namespaceId() !== pg.nsSpecialId && navpop.article.talkPage()) {
            setPopupHTML(makeFixDab(wikiText, navpop), "popupFixDab", navpop.idNumber);
        }
    };
    export const popupRedlinkHTML = (article) => changeLinkTargetLink({
        newTarget: null,
        text: popupString("remove this link").split(" ").join("&nbsp;"),
        hint: popupString("remove all links to this page from this article"),
        clickButton: getValueOf("popupRedlinkAutoClick"),
        oldTarget: article.toString(),
        summary: simplePrintf(getValueOf("popupRedlinkSummary"), [article.toString()]),
    });
