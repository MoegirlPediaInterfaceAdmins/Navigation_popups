import { makeFixDabs, popupRedlinkHTML } from "./dab.ts";
import { loadDiff } from "./diffpreview.ts";
import { abortAllDownloads } from "./downloader.ts";
import type { Downloader } from "./downloader.ts";
import { log, pg } from "../globals.ts";
import { fillEmptySpans, popupHTML, setPopupHTML, setPopupTrailer } from "./htmloutput.ts";
import { getValidImageFromWikiText, loadImage } from "./images.ts";
import { redirLink } from "./links.ts";
import { checkPopupPosition, mouseOutWikiLink } from "./mouseout.ts";
import { Navpopup } from "./navpopup.ts";
import { getValueOf, setDefault } from "./options.ts";
import { getPageInfo } from "./pageinfo.ts";
import { Previewmaker } from "./previewmaker.ts";
import { loadAPIPreview } from "./querypreview.ts";
import { doSelectionPopup } from "./selpop.ts";
import { addPopupShortcuts, rmPopupShortcuts } from "./shortcutkeys.ts";
import { popupString } from "./strings.ts";
import { Title, anchorContainsImage, isPopupLink, parseParams } from "./titles.ts";
import { joinPath, literalizeRegex, simplePrintf } from "./tools.ts";
export const setupTooltips = (_container?: unknown, remove = false, force = false, popData: { owner?: Navpopup } & Record<string, unknown> | null = null) => {
    let container = _container as Element | Document | null | undefined;
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- debug log stringifies the container node on purpose
    log(`setupTooltips, container=${String(container)}, remove=${String(remove)}`);
    if (!container) {
        if (getValueOf("popupOnEditSelection") && document.editform?.wpTextbox1) {
            document.editform.wpTextbox1.onmouseup = doSelectionPopup;
        }
        container = defaultPopupsContainer();
    }
    if (!remove && !force && container.ranSetupTooltipsAlready) {
        return;
    }
    container.ranSetupTooltipsAlready = !remove;
    const anchors = container.getElementsByTagName("A") as HTMLCollectionOf<HTMLAnchorElement>;
    setupTooltipsLoop(anchors, 0, 250, 100, remove, popData);
};
const defaultPopupsContainer = (): Element | Document => {
    if (getValueOf("popupOnlyArticleLinks")) {
        const moeskinArticle = document.getElementsByTagName("article")[0] as Element | undefined; // moeskin
        return document.querySelector(".skin-vector-2022 .vector-body")
            ?? document.getElementById("mw_content")
            ?? document.getElementById("content")
            ?? document.getElementById("article")
            ?? moeskinArticle
            ?? document;
    }
    return document;
};
const setupTooltipsLoop = (anchors: HTMLCollectionOf<HTMLAnchorElement>, begin: number, howmany: number, sleep: number, remove: boolean, popData: { owner?: Navpopup } & Record<string, unknown> | null) => {
    log(simplePrintf("setupTooltipsLoop(%s,%s,%s,%s,%s)", [anchors, begin, howmany, sleep, remove, popData]));
    const finish = begin + howmany;
    const loopend = Math.min(finish, anchors.length);
    let j = loopend - begin;
    log(`setupTooltips: anchors.length=${anchors.length}, begin=${begin}, howmany=${howmany}, loopend=${loopend}, remove=${String(remove)}`);
    const doTooltip: (a: HTMLAnchorElement, popData: { owner?: Navpopup } & Record<string, unknown> | null) => void = remove ? removeTooltip : addTooltip;
    if (j > 0) {
        do {
            const a = anchors[loopend - j];
            if (!a.href) {
                log(`got null anchor at index ${loopend - j}`);
                continue;
            }
            doTooltip(a, popData);
        } while (--j);
    }
    if (finish < anchors.length) {
        setTimeout(() => {
            setupTooltipsLoop(anchors, finish, howmany, sleep, remove, popData);
        }, sleep);
    } else {
        if (!remove && !getValueOf("popupTocLinks")) {
            rmTocTooltips();
        }
        pg.flag.finishedLoading = true;
    }
};
const rmTocTooltips = () => {
    const toc = document.getElementById("toc");
    if (toc) {
        const tocLinks = toc.getElementsByTagName("A") as HTMLCollectionOf<HTMLAnchorElement>;
        const tocLen = tocLinks.length;
        for (let j = 0; j < tocLen; ++j) {
            removeTooltip(tocLinks[j]);
        }
    }
};
const addTooltip = (a: HTMLAnchorElement, popData?: { owner?: Navpopup } & Record<string, unknown> | null) => {
    if (!isPopupLink(a)) {
        return;
    }
    a.onmouseover = mouseOverWikiLink;
    a.onmouseout = mouseOutWikiLink;
    a.onmousedown = killPopup;
    a.hasPopup = true;
    a.popData = popData;
};
const removeTooltip = (a: HTMLAnchorElement) => {
    if (!a.hasPopup) {
        return;
    }
    a.onmouseover = null;
    a.onmouseout = null;
    if (a.originalTitle) {
        a.title = a.originalTitle;
    }
    a.hasPopup = false;
};
const removeTitle = (a: HTMLAnchorElement) => {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string is a meaningful value here; the || branch is deliberate upstream behavior
    if (!a.originalTitle) {
        a.originalTitle = a.title;
    }
    a.title = "";
};
export const restoreTitle = (a: HTMLAnchorElement) => {
    if (a.title || !a.originalTitle) {
        return;
    }
    a.title = a.originalTitle;
};
const registerHooks = (np: Navpopup) => {
    const popupMaxWidth = getValueOf("popupMaxWidth");
    if (typeof popupMaxWidth === "number") {
        const setMaxWidth = () => {
            np.mainDiv.style.maxWidth = `${popupMaxWidth}px`;
            np.maxWidth = popupMaxWidth;
        };
        np.addHook(setMaxWidth, "unhide", "before");
    }
    np.addHook(addPopupShortcuts, "unhide", "after");
    np.addHook(rmPopupShortcuts, "hide", "before");
};
export const removeModifierKeyHandler = (a: HTMLAnchorElement) => {
    document.removeEventListener("keydown", a.modifierKeyHandler as EventListener, false);
    document.removeEventListener("keyup", a.modifierKeyHandler as EventListener, false);
};
function mouseOverWikiLink(this: GlobalEventHandlers, _evt?: MouseEvent) {
    const self = this as HTMLAnchorElement;
    let evt = _evt;
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy window.event fallback is upstream behavior
    evt ??= window.event as MouseEvent | undefined;
    if (getValueOf("popupModifier")) {
        const action = getValueOf("popupModifierAction");
        const key = action === "disable" ? "keyup" : "keydown";
        const a = self;
        a.modifierKeyHandler = (evt) => {
            mouseOverWikiLink2(a, evt as MouseEvent);
        };
        document.addEventListener(key, a.modifierKeyHandler, false);
    }
    mouseOverWikiLink2(self, evt);
}
const footnoteTarget = (a: HTMLAnchorElement): HTMLElement | false => {
    const aTitle = Title.fromAnchor(a);
    const anch = aTitle.anchor;
    if (!/^(cite_note-|_note-|endnote)/.test(anch)) {
        return false;
    }
    const lTitle = Title.fromURL(location.href);
    if (lTitle.toString(true) !== aTitle.toString(true)) {
        return false;
    }
    let el = document.getElementById(anch);
    while (el && typeof el.nodeName === "string") {
        const nt = el.nodeName.toLowerCase();
        if (nt === "li") {
            return el;
        } else if (nt === "body") {
            return false;
        } else if (el.parentNode) {
            el = el.parentNode as HTMLElement;
        } else {
            return false;
        }
    }
    return false;
};
const footnotePreview = (x: HTMLElement, navpop: Navpopup) => {
    setPopupHTML(`<hr />${x.innerHTML}`, "popupPreview", navpop.idNumber);
};
const modifierPressed = (_evt?: MouseEvent) => {
    let evt = _evt;
    const mod = getValueOf("popupModifier");
    if (!mod) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy window.event fallback is upstream behavior
    evt ??= window.event as MouseEvent | undefined;
    return Boolean(evt && mod && (evt as unknown as Record<string, unknown>)[`${String(mod as string | number | boolean).toLowerCase()}Key`]);
};
const isCorrectModifier = (a: HTMLAnchorElement, evt?: MouseEvent) => {
    if (!getValueOf("popupModifier")) {
        return true;
    }
    const action = getValueOf("popupModifierAction");
    return action === "enable" && modifierPressed(evt) || action === "disable" && !modifierPressed(evt);
};
export const mouseOverWikiLink2 = (a: HTMLAnchorElement, evt?: MouseEvent) => {
    if (!isCorrectModifier(a, evt)) {
        return;
    }
    if (getValueOf("removeTitles")) {
        removeTitle(a);
    }
    if (a === pg.current.link && a.navpopup?.isVisible()) {
        return;
    }
    pg.current.link = a;
    if (getValueOf("simplePopups") && !pg.option.popupStructure) {
        setDefault("popupStructure", "original");
    }
    const article = new Title().fromAnchor(a);
    pg.current.article = article;
    if (!a.navpopup) {
        a.navpopup = newNavpopup(a, article);
        pg.current.linksHash[a.href] = a.navpopup;
        pg.current.links.push(a);
    }
    if (a.navpopup.pending === null || a.navpopup.pending !== 0) {
        simplePopupContent(a, article);
    }
    a.navpopup.showSoonIfStable(a.navpopup.delay);
    clearInterval(pg.timer.checkPopupPosition as number);
    pg.timer.checkPopupPosition = setInterval(checkPopupPosition, 600);
    if (getValueOf("simplePopups")) {
        if (getValueOf("popupPreviewButton") && !a.simpleNoMore) {
            const d = document.createElement("div");
            d.className = "popupPreviewButtonDiv";
            const s = document.createElement("span");
            d.appendChild(s);
            s.className = "popupPreviewButton";
            (s as unknown as Record<string, unknown>)[`on${getValueOf("popupPreviewButtonEvent") as string}`] = () => {
                a.simpleNoMore = true;
                d.style.display = "none";
                nonsimplePopupContent(a, article);
            };
            s.innerHTML = popupString("show preview");
            setPopupHTML(d, "popupPreview", a.navpopup.idNumber);
        }
    }
    if (a.navpopup.pending !== 0) {
        nonsimplePopupContent(a, article);
    }
};
const simplePopupContent = (a: HTMLAnchorElement, article: Title) => {
    const navpop = a.navpopup;
    if (!navpop) {
        return;
    }
    navpop.hasPopupMenu = false;
    navpop.setInnerHTML(popupHTML(a));
    fillEmptySpans({
        navpopup: navpop,
    });
    if (getValueOf("popupDraggable")) {
        let dragHandle = (getValueOf("popupDragHandle") as string | null) ?? null;
        if (dragHandle && dragHandle !== "all") {
            dragHandle += String(navpop.idNumber);
        }
        setTimeout(() => {
            navpop.makeDraggable(dragHandle);
        }, 150);
    }
    if (getValueOf("popupRedlinkRemoval") && a.className === "new") {
        setPopupHTML(`<br>${String(popupRedlinkHTML(article))}`, "popupRedlink", navpop.idNumber);
    }
};
const debugData = (navpopup: Navpopup) => {
    if (getValueOf("popupDebugging") && navpopup.idNumber) {
        setPopupHTML(`idNumber=${navpopup.idNumber}, pending=${String(navpopup.pending)}`, "popupError", navpopup.idNumber);
    }
};
const newNavpopup = (a: HTMLAnchorElement, article: Title) => {
    const navpopup = new Navpopup();
    navpopup.fuzz = 5;
    navpopup.delay = Number(getValueOf("popupDelay")) * 1e3;
    navpopup.idNumber = ++pg.idNumber;
    navpopup.parentAnchor = a;
    navpopup.parentPopup = a.popData?.owner;
    navpopup.article = article;
    registerHooks(navpopup);
    return navpopup;
};
const shouldShowNonSimple = (a: HTMLAnchorElement) => !getValueOf("simplePopups") || a.simpleNoMore;
const shouldShow = (a: HTMLAnchorElement, option: string) => {
    if (shouldShowNonSimple(a)) {
        return getValueOf(option);
    }
    const w = window as unknown as Record<string, unknown>;
    return typeof w[option] !== "undefined" && w[option];
};
const nonsimplePopupContent = (a: HTMLAnchorElement, article: Title) => {
    const navpop = a.navpopup;
    if (!navpop) {
        return;
    }
    let diff: string | null = null,
        history: boolean | null = null;
    const params = parseParams(a.href);
    const oldid = typeof params.oldid === "undefined" ? null : params.oldid;
    if (shouldShow(a, "popupPreviewDiffs")) {
        diff = params.diff;
    }
    if (shouldShow(a, "popupPreviewHistory")) {
        history = params.action === "history";
    }
    navpop.pending = 0;
    const referenceElement = footnoteTarget(a);
    if (referenceElement) {
        footnotePreview(referenceElement, navpop);
    } else if (diff) {
        void loadDiff(article, oldid, diff, navpop);
    } else if (history) {
        loadAPIPreview("history", article, navpop);
    } else if (shouldShowNonSimple(a) && (pg.re.contribs as RegExp).test(a.href)) {
        loadAPIPreview("contribs", article, navpop);
    } else if (shouldShowNonSimple(a) && (pg.re.backlinks as RegExp).test(a.href)) {
        loadAPIPreview("backlinks", article, navpop);
    } else if (article.namespaceId() === pg.nsImageId && (shouldShow(a, "imagePopupsForImages") || !anchorContainsImage(a))) {
        loadAPIPreview("imagepagepreview", article, navpop);
        loadImage(article, navpop);
    } else {
        if (article.namespaceId() === pg.nsCategoryId && shouldShow(a, "popupCategoryMembers")) {
            loadAPIPreview("category", article, navpop);
        } else if ((article.namespaceId() === pg.nsUserId || article.namespaceId() === pg.nsUsertalkId) && shouldShow(a, "popupUserInfo")) {
            loadAPIPreview("userinfo", article, navpop);
        }
        if (shouldShowNonSimple(a)) {
            startArticlePreview(article, oldid, navpop);
        }
    }
};
export const pendingNavpopTask = (navpop: Navpopup) => {
    navpop.pending ??= 0;
    ++navpop.pending;
    debugData(navpop);
};
export const completedNavpopTask = (navpop: Navpopup) => {
    if (navpop.pending) {
        --navpop.pending;
    }
    debugData(navpop);
};
const startArticlePreview = (article: Title, oldid: string | null, navpop: Navpopup) => {
    navpop.redir = 0;
    loadPreview(article, oldid, navpop);
};
const loadPreview = (article: Title, oldid: string | null, navpop: Navpopup) => {
    if (!navpop.redir) {
        navpop.originalArticle = article;
    }
    article.oldid = oldid;
    loadAPIPreview("revision", article, navpop);
};
const loadPreviewFromRedir = (redirMatch: RegExpExecArray, navpop: Navpopup) => {
    const target = new Title().fromWikiText(redirMatch[2]);
    if (navpop.article?.anchor) {
        target.anchor = navpop.article.anchor;
    }
    navpop.redir++;
    navpop.redirTarget = target;
    const warnRedir = navpop.article ? redirLink(target, navpop.article) : "";
    setPopupHTML(warnRedir, "popupWarnRedir", navpop.idNumber);
    navpop.article = target;
    fillEmptySpans({
        redir: true,
        redirTarget: target,
        navpopup: navpop,
    });
    loadPreview(target, null, navpop);
};
export const insertPreview = (download: Downloader) => {
    if (!download.owner) {
        return;
    }
    const redirMatch = (pg.re.redirect as RegExp).exec(download.data ?? "");
    if (download.owner.redir === 0 && redirMatch) {
        loadPreviewFromRedir(redirMatch, download.owner);
        return;
    }
    if (download.owner.visible || !getValueOf("popupLazyPreviews")) {
        insertPreviewNow(download);
    } else {
        const id = download.owner.redir ? "PREVIEW_REDIR_HOOK" : "PREVIEW_HOOK";
        download.owner.addHook(() => {
            insertPreviewNow(download);
            return true;
        }, "unhide", "after", id);
    }
};
const insertPreviewNow = (download: Downloader) => {
    if (!download.owner) {
        return;
    }
    const wikiText = download.data ?? "";
    const navpop = download.owner;
    const art = navpop.redirTarget ?? navpop.originalArticle;
    if (!art) {
        return;
    }
    makeFixDabs(wikiText, navpop);
    if (getValueOf("popupSummaryData")) {
        getPageInfo(wikiText, download);
        setPopupTrailer(getPageInfo(wikiText, download), navpop.idNumber);
    }
    let imagePage;
    if (art.namespaceId() === pg.nsImageId) {
        imagePage = art.toString();
    } else {
        imagePage = getValidImageFromWikiText(wikiText);
    }
    if (imagePage) {
        loadImage(Title.fromWikiText(imagePage), navpop);
    }
    if (getValueOf("popupPreviews")) {
        insertArticlePreview(download, art, navpop);
    }
};
const insertArticlePreview = (download: Downloader, art: Title, navpop: Navpopup) => {
    if (typeof download.data === "string") {
        if (art.namespaceId() === pg.nsTemplateId && getValueOf("popupPreviewRawTemplates")) {
            const h = `<hr /><span style="font-family: monospace;">${download.data.entify().split("\\n").join("<br />\\n")}</span>`;
            setPopupHTML(h, "popupPreview", navpop.idNumber);
        } else {
            const p = prepPreviewmaker(download.data, art, navpop);
            p.showPreview();
        }
    }
};
export const prepPreviewmaker = (data: string, article: Title, navpop: Navpopup): Previewmaker => {
    const d = anchorize(data, article.anchorString());
    const urlBase = joinPath([pg.wiki.articlebase, article.urlString()]);
    const p = new Previewmaker(d, urlBase, navpop);
    return p;
};
const anchorize = (d: string, anch: string): string => {
    if (!anch) {
        return d;
    }
    const anchRe = RegExp(`(?:=+\\s*${literalizeRegex(anch).replace(/[_ ]/g, "[_ ]")}\\s*=+|\\{\\{\\s*${getValueOf("popupAnchorRegexp") as string}\\s*(?:\\|[^|}]*)*?\\s*${literalizeRegex(anch)}\\s*(?:\\|[^}]*)?}})`);
    const match = d.match(anchRe);
    if (match && match.length > 0 && match[0]) {
        return d.substring(d.indexOf(match[0]));
    }
    const lines = d.split("\n");
    for (let i = 0; i < lines.length; ++i) {
        lines[i] = lines[i].replace(RegExp("[[]{2}([^|\\]]*?[|])?(.*?)[\\]]{2}", "g"), "$2").replace(/'''([^'])/g, "$1").replace(RegExp("''([^'])", "g"), "$1");
        if (lines[i].match(anchRe)) {
            return d.split("\n").slice(i).join("\n").replace(RegExp("^[^=]*"), "");
        }
    }
    return d;
};
export function killPopup(this: GlobalEventHandlers) {
    removeModifierKeyHandler(this as HTMLAnchorElement);
    if (getValueOf("popupShortcutKeys")) {
        rmPopupShortcuts();
    }
    if (pg.current.link?.navpopup) {
        pg.current.link.navpopup.banish();
    }
    pg.current.link = null;
    abortAllDownloads();
    if (pg.timer.checkPopupPosition) {
        clearInterval(pg.timer.checkPopupPosition as number);
        pg.timer.checkPopupPosition = null;
    }
    return true;
}
