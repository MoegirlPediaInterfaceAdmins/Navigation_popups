// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { makeFixDabs, popupRedlinkHTML } from "./dab.ts";
import { loadDiff } from "./diffpreview.ts";
import { abortAllDownloads } from "./downloader.ts";
import { log, pg } from "./globals.ts";
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
    export const setupTooltips = (_container: unknown, remove = false, force = false, popData = null) => {
        let container = _container;
        log(`setupTooltips, container=${container}, remove=${remove}`);
        if (!container) {
            if (getValueOf("popupOnEditSelection") && document && document.editform && document.editform.wpTextbox1) {
                document.editform.wpTextbox1.onmouseup = doSelectionPopup;
            }
            container = defaultPopupsContainer();
        }
        if (!remove && !force && container.ranSetupTooltipsAlready) {
            return;
        }
        container.ranSetupTooltipsAlready = !remove;
        const anchors = container.getElementsByTagName("A");
        setupTooltipsLoop(anchors, 0, 250, 100, remove, popData);
    };
    const defaultPopupsContainer = () => {
        if (getValueOf("popupOnlyArticleLinks")) {
            return document.querySelector(".skin-vector-2022 .vector-body") || document.getElementById("mw_content") || document.getElementById("content") || document.getElementById("article")
                || document.getElementsByTagName("article")?.[0] // moeskin
                || document;
        }
        return document;
    };
    const setupTooltipsLoop = (anchors, begin, howmany, sleep, remove, popData) => {
        log(simplePrintf("setupTooltipsLoop(%s,%s,%s,%s,%s)", [anchors, begin, howmany, sleep, remove, popData]));
        const finish = begin + howmany;
        const loopend = Math.min(finish, anchors.length);
        let j = loopend - begin;
        log(`setupTooltips: anchors.length=${anchors.length}, begin=${begin}, howmany=${howmany}, loopend=${loopend}, remove=${remove}`);
        const doTooltip = remove ? removeTooltip : addTooltip;
        if (j > 0) {
            do {
                const a = anchors[loopend - j];
                if (typeof a === "undefined" || !a || !a.href) {
                    log(`got null anchor at index ${loopend}` - j);
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
            const tocLinks = toc.getElementsByTagName("A");
            const tocLen = tocLinks.length;
            for (let j = 0; j < tocLen; ++j) {
                removeTooltip(tocLinks[j], true);
            }
        }
    };
    const addTooltip = (a, popData) => {
        if (!isPopupLink(a)) {
            return;
        }
        a.onmouseover = mouseOverWikiLink;
        a.onmouseout = mouseOutWikiLink;
        a.onmousedown = killPopup;
        a.hasPopup = true;
        a.popData = popData;
    };
    const removeTooltip = (a) => {
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
    const removeTitle = (a) => {
        if (!a.originalTitle) {
            a.originalTitle = a.title;
        }
        a.title = "";
    };
    export const restoreTitle = (a) => {
        if (a.title || !a.originalTitle) {
            return;
        }
        a.title = a.originalTitle;
    };
    const registerHooks = (np) => {
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
    export const removeModifierKeyHandler = (a) => {
        document.removeEventListener("keydown", a.modifierKeyHandler, false);
        document.removeEventListener("keyup", a.modifierKeyHandler, false);
    };
    function mouseOverWikiLink(_evt) {
        let evt = _evt;
        if (!evt && window.event) {
            evt = window.event;
        }
        if (getValueOf("popupModifier")) {
            const action = getValueOf("popupModifierAction");
            const key = action === "disable" ? "keyup" : "keydown";
            const a = this;
            a.modifierKeyHandler = (evt) => {
                mouseOverWikiLink2(a, evt);
            };
            document.addEventListener(key, a.modifierKeyHandler, false);
        }
        return mouseOverWikiLink2(this, evt);
    }
    const footnoteTarget = (a) => {
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
                el = el.parentNode;
            } else {
                return false;
            }
        }
        return false;
    };
    const footnotePreview = (x, navpop) => {
        setPopupHTML(`<hr />${x.innerHTML}`, "popupPreview", navpop.idNumber);
    };
    const modifierPressed = (_evt) => {
        let evt = _evt;
        const mod = getValueOf("popupModifier");
        if (!mod) {
            return false;
        }
        if (!evt && window.event) {
            evt = window.event;
        }
        return evt && mod && evt[`${mod.toLowerCase()}Key`];
    };
    const isCorrectModifier = (a, evt) => {
        if (!getValueOf("popupModifier")) {
            return true;
        }
        const action = getValueOf("popupModifierAction");
        return action === "enable" && modifierPressed(evt) || action === "disable" && !modifierPressed(evt);
    };
    export const mouseOverWikiLink2 = (a, evt) => {
        if (!isCorrectModifier(a, evt)) {
            return;
        }
        if (getValueOf("removeTitles")) {
            removeTitle(a);
        }
        if (a === pg.current.link && a.navpopup && a.navpopup.isVisible()) {
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
        clearInterval(pg.timer.checkPopupPosition);
        pg.timer.checkPopupPosition = setInterval(checkPopupPosition, 600);
        if (getValueOf("simplePopups")) {
            if (getValueOf("popupPreviewButton") && !a.simpleNoMore) {
                const d = document.createElement("div");
                d.className = "popupPreviewButtonDiv";
                const s = document.createElement("span");
                d.appendChild(s);
                s.className = "popupPreviewButton";
                s[`on${getValueOf("popupPreviewButtonEvent")}`] = () => {
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
    const simplePopupContent = (a, article) => {
        a.navpopup.hasPopupMenu = false;
        a.navpopup.setInnerHTML(popupHTML(a));
        fillEmptySpans({
            navpopup: a.navpopup,
        });
        if (getValueOf("popupDraggable")) {
            let dragHandle = getValueOf("popupDragHandle") || null;
            if (dragHandle && dragHandle !== "all") {
                dragHandle += a.navpopup.idNumber;
            }
            setTimeout(() => {
                a.navpopup.makeDraggable(dragHandle);
            }, 150);
        }
        if (getValueOf("popupRedlinkRemoval") && a.className === "new") {
            setPopupHTML(`<br>${popupRedlinkHTML(article)}`, "popupRedlink", a.navpopup.idNumber);
        }
    };
    const debugData = (navpopup) => {
        if (getValueOf("popupDebugging") && navpopup.idNumber) {
            setPopupHTML(`idNumber=${navpopup.idNumber}, pending=${navpopup.pending}`, "popupError", navpopup.idNumber);
        }
    };
    const newNavpopup = (a, article) => {
        const navpopup = new Navpopup();
        navpopup.fuzz = 5;
        navpopup.delay = getValueOf("popupDelay") * 1e3;
        navpopup.idNumber = ++pg.idNumber;
        navpopup.parentAnchor = a;
        navpopup.parentPopup = a.popData && a.popData.owner;
        navpopup.article = article;
        registerHooks(navpopup);
        return navpopup;
    };
    const shouldShowNonSimple = (a) => !getValueOf("simplePopups") || a.simpleNoMore;
    const shouldShow = (a, option) => {
        if (shouldShowNonSimple(a)) {
            return getValueOf(option);
        }
        return typeof window[option] !== "undefined" && window[option];
    };
    const nonsimplePopupContent = (a, article) => {
        let diff = null,
            history = null;
        const params = parseParams(a.href);
        const oldid = typeof params.oldid === "undefined" ? null : params.oldid;
        if (shouldShow(a, "popupPreviewDiffs")) {
            diff = params.diff;
        }
        if (shouldShow(a, "popupPreviewHistory")) {
            history = params.action === "history";
        }
        a.navpopup.pending = 0;
        const referenceElement = footnoteTarget(a);
        if (referenceElement) {
            footnotePreview(referenceElement, a.navpopup);
        } else if (diff || diff === 0) {
            loadDiff(article, oldid, diff, a.navpopup);
        } else if (history) {
            loadAPIPreview("history", article, a.navpopup);
        } else if (shouldShowNonSimple(a) && pg.re.contribs.test(a.href)) {
            loadAPIPreview("contribs", article, a.navpopup);
        } else if (shouldShowNonSimple(a) && pg.re.backlinks.test(a.href)) {
            loadAPIPreview("backlinks", article, a.navpopup);
        } else if (article.namespaceId() === pg.nsImageId && (shouldShow(a, "imagePopupsForImages") || !anchorContainsImage(a))) {
            loadAPIPreview("imagepagepreview", article, a.navpopup);
            loadImage(article, a.navpopup);
        } else {
            if (article.namespaceId() === pg.nsCategoryId && shouldShow(a, "popupCategoryMembers")) {
                loadAPIPreview("category", article, a.navpopup);
            } else if ((article.namespaceId() === pg.nsUserId || article.namespaceId() === pg.nsUsertalkId) && shouldShow(a, "popupUserInfo")) {
                loadAPIPreview("userinfo", article, a.navpopup);
            }
            if (shouldShowNonSimple(a)) {
                startArticlePreview(article, oldid, a.navpopup);
            }
        }
    };
    export const pendingNavpopTask = (navpop) => {
        if (navpop && navpop.pending === null) {
            navpop.pending = 0;
        }
        ++navpop.pending;
        debugData(navpop);
    };
    export const completedNavpopTask = (navpop) => {
        if (navpop && navpop.pending) {
            --navpop.pending;
        }
        debugData(navpop);
    };
    const startArticlePreview = (article, oldid, navpop) => {
        navpop.redir = 0;
        loadPreview(article, oldid, navpop);
    };
    const loadPreview = (article, oldid, navpop) => {
        if (!navpop.redir) {
            navpop.originalArticle = article;
        }
        article.oldid = oldid;
        loadAPIPreview("revision", article, navpop);
    };
    const loadPreviewFromRedir = (redirMatch, navpop) => {
        const target = new Title().fromWikiText(redirMatch[2]);
        if (navpop.article.anchor) {
            target.anchor = navpop.article.anchor;
        }
        navpop.redir++;
        navpop.redirTarget = target;
        const warnRedir = redirLink(target, navpop.article);
        setPopupHTML(warnRedir, "popupWarnRedir", navpop.idNumber);
        navpop.article = target;
        fillEmptySpans({
            redir: true,
            redirTarget: target,
            navpopup: navpop,
        });
        return loadPreview(target, null, navpop);
    };
    export const insertPreview = (download) => {
        if (!download.owner) {
            return;
        }
        const redirMatch = pg.re.redirect.exec(download.data);
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
    const insertPreviewNow = (download) => {
        if (!download.owner) {
            return;
        }
        const wikiText = download.data;
        const navpop = download.owner;
        const art = navpop.redirTarget || navpop.originalArticle;
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
    const insertArticlePreview = (download, art, navpop) => {
        if (download && typeof download.data === typeof "") {
            if (art.namespaceId() === pg.nsTemplateId && getValueOf("popupPreviewRawTemplates")) {
                const h = `<hr /><span style="font-family: monospace;">${download.data.entify().split("\\n").join("<br />\\n")}</span>`;
                setPopupHTML(h, "popupPreview", navpop.idNumber);
            } else {
                const p = prepPreviewmaker(download.data, art, navpop);
                p.showPreview();
            }
        }
    };
    export const prepPreviewmaker = (data, article, navpop) => {
        const d = anchorize(data, article.anchorString());
        const urlBase = joinPath([pg.wiki.articlebase, article.urlString()]);
        const p = new Previewmaker(d, urlBase, navpop);
        return p;
    };
    const anchorize = (d, anch) => {
        if (!anch) {
            return d;
        }
        const anchRe = RegExp(`(?:=+\\s*${literalizeRegex(anch).replace(/[_ ]/g, "[_ ]")}\\s*=+|\\{\\{\\s*${getValueOf("popupAnchorRegexp")}\\s*(?:\\|[^|}]*)*?\\s*${literalizeRegex(anch)}\\s*(?:\\|[^}]*)?}})`);
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
    export function killPopup() {
        removeModifierKeyHandler(this);
        if (getValueOf("popupShortcutKeys")) {
            rmPopupShortcuts();
        }
        if (!pg) {
            return;
        }
        if (pg.current.link && pg.current.link.navpopup) {
            pg.current.link.navpopup.banish();
        }
        pg.current.link = null;
        abortAllDownloads();
        if (pg.timer.checkPopupPosition) {
            clearInterval(pg.timer.checkPopupPosition);
            pg.timer.checkPopupPosition = null;
        }
        return true;
    }
