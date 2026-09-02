import { completedNavpopTask, pendingNavpopTask } from "./actions.ts";
import { countCrossings, diff, diffString, shortenDiffString } from "./diff.ts";
import { getPageWithCaching } from "./getpage.ts";
import { errlog, pg } from "./globals.ts";
import { setPopupHTML, setPopupTipsAndHTML } from "./htmloutput.ts";
import { getMwApi } from "./init.ts";
import { generalLink, titledWikiLink } from "./links.ts";
import { getValueOf } from "./options.ts";
import { formattedDateTime } from "./querypreview.ts";
import { popupString, tprintf } from "./strings.ts";
import { getJsObj, simplePrintf } from "./tools.ts";
    export const loadDiff = async (article, oldid, diff, navpop) => {
        navpop.diffData = {
            oldRev: {},
            newRev: {},
        };
        // await mw.loader.using(["mediawiki.api"]);
        const api = getMwApi();
        const params = {
            action: "compare",
            prop: "ids|title",
        };
        params.fromtitle = article.toString();
        switch (diff) {
            case "cur":
                switch (oldid) {
                    case null:
                    case "":
                    case "prev":
                        params.torelative = "prev";
                        break;
                    default:
                        params.fromrev = oldid;
                        params.torelative = "cur";
                        break;
                }
                break;
            case "prev":
                if (oldid && oldid !== "cur") {
                    params.fromrev = oldid;
                }
                params.torelative = "prev";
                break;
            case "next":
                params.fromrev = oldid || 0;
                params.torelative = "next";
                break;
            default:
                params.fromrev = oldid || 0;
                params.torev = diff || 0;
                break;
        }
        const data = await api.get(params);
        navpop.diffData.oldRev.revid = data.compare.fromrevid;
        navpop.diffData.newRev.revid = data.compare.torevid;
        addReviewLink(navpop, "popupMiscTools");
        const go = () => {
            pendingNavpopTask(navpop);
            let url = `${pg.wiki.apiwikibase}?format=json&formatversion=2&action=query&`;
            url += `revids=${navpop.diffData.oldRev.revid}|${navpop.diffData.newRev.revid}`;
            url += "&prop=revisions&rvslots=main&rvprop=ids|timestamp|content";
            getPageWithCaching(url, doneDiff, navpop);
            return true;
        };
        if (navpop.visible || !getValueOf("popupLazyDownloads")) {
            go();
        } else {
            navpop.addHook(go, "unhide", "before", "DOWNLOAD_DIFFS");
        }
    };
    const addReviewLink = async (navpop, target) => {
        if (!pg.user.canReview) {
            return;
        }
        if (navpop.diffData.newRev.revid <= navpop.diffData.oldRev.revid) {
            return;
        }
        const params = {
            action: "query",
            prop: "info|flagged",
            revids: navpop.diffData.oldRev.revid,
            formatversion: 2,
        };
        const data = await getMwApi().get(params);

        const stable_revid = data.query.pages[0].flagged && data.query.pages[0].flagged.stable_revid || 0;
        if (stable_revid === navpop.diffData.oldRev.revid) {
            const a = document.createElement("a");
            a.innerHTML = popupString("mark patrolled");
            a.title = popupString("markpatrolledHint");
            a.onclick = async () => {
                const params = {
                    action: "review",
                    revid: navpop.diffData.newRev.revid,
                    comment: tprintf("defaultpopupReviewedSummary", [navpop.diffData.oldRev.revid, navpop.diffData.newRev.revid]),
                };
                try {
                    await getMwApi().postWithToken("csrf", params);
                    a.style.display = "none";
                } catch {
                    alert(popupString("Could not marked this edit as patrolled"));
                }
            };
            setPopupHTML(a, target, navpop.idNumber, null, true);
        }
    };
    const doneDiff = (download) => {
        if (!download.owner || !download.owner.diffData) {
            return;
        }
        const navpop = download.owner;
        completedNavpopTask(navpop);
        let pages, revisions = [];
        try {
            pages = getJsObj(download.data).query.pages;
            for (let i = 0; i < pages.length; i++) {
                revisions = revisions.concat(pages[i].revisions);
            }
            for (let j = 0; j < revisions.length; j++) {
                if (revisions[j].revid === navpop.diffData.oldRev.revid) {
                    navpop.diffData.oldRev.revision = revisions[j];
                } else if (revisions[j].revid === navpop.diffData.newRev.revid) {
                    navpop.diffData.newRev.revision = revisions[j];
                }
            }
        } catch (someError) {
            errlog("Could not get diff");
        }
        insertDiff(navpop);
    };
    const rmBoringLines = (a, b, _context) => {
        let context = _context;
        if (typeof context === "undefined") {
            context = 2;
        }
        const aa = [],
            aaa = [];
        const bb = [],
            bbb = [];
        let i, j;
        for (i = 0; i < a.length; ++i) {
            if (!a[i].paired) {
                aa[i] = 1;
            } else if (countCrossings(b, a, i, true)) {
                aa[i] = 1;
                bb[a[i].row] = 1;
            }
        }
        for (i = 0; i < b.length; ++i) {
            if (bb[i] === 1) {
                continue;
            }
            if (!b[i].paired) {
                bb[i] = 1;
            }
        }
        for (i = 0; i < b.length; ++i) {
            if (bb[i] === 1) {
                for (j = Math.max(0, i - context); j < Math.min(b.length, i + context); ++j) {
                    if (!bb[j]) {
                        bb[j] = 1;
                        aa[b[j].row] = 0.5;
                    }
                }
            }
        }
        for (i = 0; i < a.length; ++i) {
            if (aa[i] === 1) {
                for (j = Math.max(0, i - context); j < Math.min(a.length, i + context); ++j) {
                    if (!aa[j]) {
                        aa[j] = 1;
                        bb[a[j].row] = 0.5;
                    }
                }
            }
        }
        for (i = 0; i < bb.length; ++i) {
            if (bb[i] > 0) {
                if (b[i].paired) {
                    bbb.push(b[i].text);
                } else {
                    bbb.push(b[i]);
                }
            }
        }
        for (i = 0; i < aa.length; ++i) {
            if (aa[i] > 0) {
                if (a[i].paired) {
                    aaa.push(a[i].text);
                } else {
                    aaa.push(a[i]);
                }
            }
        }
        return {
            a: aaa,
            b: bbb,
        };
    };
    const stripOuterCommonLines = (a, b, context) => {
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) {
            ++i;
        }
        let j = a.length - 1;
        let k = b.length - 1;
        while (j >= 0 && k >= 0 && a[j] === b[k]) {
            --j;
            --k;
        }
        return {
            a: a.slice(Math.max(0, i - 1 - context), Math.min(a.length + 1, j + context + 1)),
            b: b.slice(Math.max(0, i - 1 - context), Math.min(b.length + 1, k + context + 1)),
        };
    };
    const insertDiff = (navpop) => {
        let oldlines = navpop.diffData.oldRev.revision.slots.main.content.split("\n");
        let newlines = navpop.diffData.newRev.revision.slots.main.content.split("\n");
        let inner = stripOuterCommonLines(oldlines, newlines, getValueOf("popupDiffContextLines"));
        oldlines = inner.a;
        newlines = inner.b;
        let truncated = false;
        getValueOf("popupDiffMaxLines");
        if (oldlines.length > pg.option.popupDiffMaxLines || newlines.length > pg.option.popupDiffMaxLines) {
            truncated = true;
            inner = stripOuterCommonLines(oldlines.slice(0, pg.option.popupDiffMaxLines), newlines.slice(0, pg.option.popupDiffMaxLines), pg.option.popupDiffContextLines);
            oldlines = inner.a;
            newlines = inner.b;
        }
        const lineDiff = diff(oldlines, newlines);
        const lines2 = rmBoringLines(lineDiff.o, lineDiff.n);
        const oldlines2 = lines2.a;
        const newlines2 = lines2.b;
        const simpleSplit = !String.prototype.parenSplit.isNative;
        let html = "<hr />";
        if (getValueOf("popupDiffDates")) {
            html += diffDatesTable(navpop);
            html += "<hr />";
        }
        html += shortenDiffString(diffString(oldlines2.join("\n"), newlines2.join("\n"), simpleSplit), getValueOf("popupDiffContextCharacters")).join("<hr />");
        setPopupTipsAndHTML(html.split("\n").join("<br>") + (truncated ? `<hr /><b>${popupString("Diff truncated for performance reasons")}</b>` : ""), "popupPreview", navpop.idNumber);
    };
    const diffDatesTable = (navpop) => {
        let html = '<table class="popup_diff_dates">';
        html += diffDatesTableRow(navpop.diffData.newRev.revision, tprintf("New revision"));
        html += diffDatesTableRow(navpop.diffData.oldRev.revision, tprintf("Old revision"));
        html += "</table>";
        return html;
    };
    const diffDatesTableRow = (revision, label) => {
        const lastModifiedDate = new Date(revision.timestamp);
        const txt = formattedDateTime(lastModifiedDate);
        const revlink = generalLink({
            url: `${mw.config.get("wgScript")}?oldid=${revision.revid}`,
            text: label,
            title: label,
        });
        return simplePrintf("<tr><td>%s</td><td>%s</td></tr>", [revlink, txt]);
    };
    export const titledDiffLink = (l) => titledWikiLink({
        article: l.article,
        action: `${l.to}&oldid=${l.from}`,
        newWin: l.newWin,
        noPopup: l.noPopup,
        text: l.text,
        title: l.title,
        actionName: "diff",
    });
