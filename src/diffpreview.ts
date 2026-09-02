import { completedNavpopTask, pendingNavpopTask } from "./actions.ts";
import { countCrossings, diff, diffString, entryOf, shortenDiffString } from "./diff.ts";
import type { DiffCell } from "./diff.ts";
import type { Downloader } from "./downloader.ts";
import { getPageWithCaching } from "./getpage.ts";
import { errlog, pg } from "./globals.ts";
import { setPopupHTML, setPopupTipsAndHTML } from "./htmloutput.ts";
import { getMwApi } from "./init.ts";
import { generalLink, titledWikiLink } from "./links.ts";
import type { Navpopup } from "./navpopup.ts";
import { getValueOf } from "./options.ts";
import { formattedDateTime } from "./querypreview.ts";
import { popupString, tprintf } from "./strings.ts";
import type { Title } from "./titles.ts";
import { getJsObj, simplePrintf } from "./tools.ts";
// one revision from the API (prop=revisions), as consumed here
export interface RevisionData {
    revid?: number;
    timestamp?: string;
    slots?: { main?: { content?: string } };
    [key: string]: unknown;
}
// the half of Navpopup.diffData describing one side of a pending diff
export interface DiffSide {
    revid?: number;
    revision?: RevisionData;
}
export const loadDiff = async (article: Title, oldid: string | number | null, diff: string | number | null, navpop: Navpopup) => {
    navpop.diffData = {
        oldRev: {},
        newRev: {},
    };
    // await mw.loader.using(["mediawiki.api"]);
    const api = getMwApi();
    const params: {
        action: string;
        prop: string;
        fromtitle?: string;
        torelative?: string;
        fromrev?: string | number;
        torev?: string | number;
    } = {
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
    const data = await api.get(params) as { compare: { fromrevid: number; torevid: number } };
    navpop.diffData.oldRev.revid = data.compare.fromrevid;
    navpop.diffData.newRev.revid = data.compare.torevid;
    void addReviewLink(navpop, "popupMiscTools");
    const go = () => {
        pendingNavpopTask(navpop);
        let url = `${pg.wiki.apiwikibase}?format=json&formatversion=2&action=query&`;
        url += `revids=${navpop.diffData?.oldRev.revid}|${navpop.diffData?.newRev.revid}`;
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
const addReviewLink = async (navpop: Navpopup, target: string) => {
    if (!pg.user.canReview) {
        return;
    }
    const diffData = navpop.diffData;
    if (!diffData) {
        return;
    }
    if (Number(diffData.newRev.revid) <= Number(diffData.oldRev.revid)) {
        return;
    }
    const params = {
        action: "query",
        prop: "info|flagged",
        revids: diffData.oldRev.revid,
        formatversion: 2,
    };
    const data = await getMwApi().get(params) as { query: { pages: { flagged?: { stable_revid?: number } }[] } };

    const stable_revid = data.query.pages[0].flagged?.stable_revid || 0;
    if (stable_revid === diffData.oldRev.revid) {
        const a = document.createElement("a");
        a.innerHTML = popupString("mark patrolled");
        a.title = popupString("markpatrolledHint");
        a.onclick = async () => {
            const params = {
                action: "review",
                revid: diffData.newRev.revid,
                comment: tprintf("defaultpopupReviewedSummary", [diffData.oldRev.revid, diffData.newRev.revid]),
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
const doneDiff = (download: Downloader) => {
    const navpop = download.owner;
    const diffData = navpop?.diffData;
    if (!navpop || !diffData) {
        return;
    }
    completedNavpopTask(navpop);
    let pages: { revisions?: RevisionData[] }[] | undefined;
    let revisions: RevisionData[] = [];
    try {
        pages = (getJsObj(download.data ?? "") as { query?: { pages?: { revisions?: RevisionData[] }[] } }).query?.pages;
        if (pages) {
            for (const page of pages) {
                revisions = revisions.concat(page.revisions ?? []);
            }
        }
        for (const revision of revisions) {
            if (revision.revid === diffData.oldRev.revid) {
                diffData.oldRev.revision = revision;
            } else if (revision.revid === diffData.newRev.revid) {
                diffData.newRev.revision = revision;
            }
        }
    } catch {
        errlog("Could not get diff");
    }
    insertDiff(navpop);
};
const rmBoringLines = (a: DiffCell[], b: DiffCell[], _context?: number) => {
    let context = _context;
    if (typeof context === "undefined") {
        context = 2;
    }
    const aa: (number | undefined)[] = [],
        aaa: DiffCell[] = [];
    const bb: (number | undefined)[] = [],
        bbb: DiffCell[] = [];
    let i: number, j: number;
    for (i = 0; i < a.length; ++i) {
        const entry = entryOf(a[i]);
        if (!entry.paired) {
            aa[i] = 1;
        } else if (countCrossings(b, a, i, true)) {
            aa[i] = 1;
            bb[entry.row ?? -1] = 1;
        }
    }
    for (i = 0; i < b.length; ++i) {
        if (bb[i] === 1) {
            continue;
        }
        const entry = entryOf(b[i]);
        if (!entry.paired) {
            bb[i] = 1;
        }
    }
    for (i = 0; i < b.length; ++i) {
        if (bb[i] === 1) {
            for (j = Math.max(0, i - context); j < Math.min(b.length, i + context); ++j) {
                if (!bb[j]) {
                    bb[j] = 1;
                    aa[entryOf(b[j]).row ?? -1] = 0.5;
                }
            }
        }
    }
    for (i = 0; i < a.length; ++i) {
        if (aa[i] === 1) {
            for (j = Math.max(0, i - context); j < Math.min(a.length, i + context); ++j) {
                if (!aa[j]) {
                    aa[j] = 1;
                    bb[entryOf(a[j]).row ?? -1] = 0.5;
                }
            }
        }
    }
    for (i = 0; i < bb.length; ++i) {
        if ((bb[i] ?? 0) > 0) {
            const entry = entryOf(b[i]);
            if (entry.paired) {
                bbb.push(entry.text ?? "");
            } else {
                bbb.push(b[i]);
            }
        }
    }
    for (i = 0; i < aa.length; ++i) {
        if ((aa[i] ?? 0) > 0) {
            const entry = entryOf(a[i]);
            if (entry.paired) {
                aaa.push(entry.text ?? "");
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
const stripOuterCommonLines = (a: string[], b: string[], context: number) => {
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
const insertDiff = (navpop: Navpopup) => {
    const oldContent = navpop.diffData?.oldRev.revision?.slots?.main?.content;
    const newContent = navpop.diffData?.newRev.revision?.slots?.main?.content;
    if (oldContent === undefined || newContent === undefined) {
        return;
    }
    let oldlines = oldContent.split("\n");
    let newlines = newContent.split("\n");
    let inner = stripOuterCommonLines(oldlines, newlines, Number(getValueOf("popupDiffContextLines")));
    oldlines = inner.a;
    newlines = inner.b;
    let truncated = false;
    getValueOf("popupDiffMaxLines");
    const maxLines = Number(pg.option.popupDiffMaxLines);
    if (oldlines.length > maxLines || newlines.length > maxLines) {
        truncated = true;
        inner = stripOuterCommonLines(oldlines.slice(0, maxLines), newlines.slice(0, maxLines), Number(pg.option.popupDiffContextLines));
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
    html += shortenDiffString(diffString(oldlines2.join("\n"), newlines2.join("\n"), simpleSplit), Number(getValueOf("popupDiffContextCharacters"))).join("<hr />");
    setPopupTipsAndHTML(html.split("\n").join("<br>") + (truncated ? `<hr /><b>${popupString("Diff truncated for performance reasons")}</b>` : ""), "popupPreview", navpop.idNumber);
};
const diffDatesTable = (navpop: Navpopup) => {
    const newRevision = navpop.diffData?.newRev.revision;
    const oldRevision = navpop.diffData?.oldRev.revision;
    let html = '<table class="popup_diff_dates">';
    if (newRevision && oldRevision) {
        html += diffDatesTableRow(newRevision, tprintf("New revision"));
        html += diffDatesTableRow(oldRevision, tprintf("Old revision"));
    }
    html += "</table>";
    return html;
};
const diffDatesTableRow = (revision: RevisionData, label: string) => {
    const lastModifiedDate = new Date(revision.timestamp ?? "");
    const txt = formattedDateTime(lastModifiedDate);
    const revlink = generalLink({
        url: `${mw.config.get("wgScript")}?oldid=${revision.revid}`,
        text: label,
        title: label,
    });
    return simplePrintf("<tr><td>%s</td><td>%s</td></tr>", [revlink, txt]);
};
export interface DiffLinkSpec {
    article: Title;
    to?: string | null;
    from?: string | number | null;
    newWin?: boolean | null;
    noPopup?: boolean | number | null;
    text?: string;
    title?: string | null;
}
export const titledDiffLink = (l: DiffLinkSpec) => titledWikiLink({
    article: l.article,
    action: `${l.to}&oldid=${l.from}`,
    newWin: l.newWin,
    noPopup: l.noPopup,
    text: l.text,
    title: l.title,
    actionName: "diff",
});
