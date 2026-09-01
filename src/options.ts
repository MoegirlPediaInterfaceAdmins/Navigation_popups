// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { pg } from "./globals.ts";
import { popupFilterCountCategories, popupFilterCountImages, popupFilterCountLinks, popupFilterDisambigDetect, popupFilterLastModified, popupFilterPageSize, popupFilterStubDetect, popupFilterWikibaseItem } from "./pageinfo.ts";
import { popupString } from "./strings.ts";
    const defaultize = (x) => {
        if (pg.option[x] === null || typeof pg.option[x] === "undefined") {
            if (typeof window[x] !== "undefined") {
                pg.option[x] = window[x];
            } else {
                pg.option[x] = pg.optionDefault[x];
            }
        }
    };
    const newOption = (x, def) => {
        pg.optionDefault[x] = def;
    };
    export const setDefault = (x, def) => newOption(x, def);
    export const getValueOf = (varName) => {
        defaultize(varName);
        return pg.option[varName];
    };
    export const setOptions = () => {
        let userIsSysop = false;
        if (mw.config.get("wgUserGroups")) {
            for (let g = 0; g < mw.config.get("wgUserGroups").length; ++g) {
                if (mw.config.get("wgUserGroups")[g] === "sysop") {
                    userIsSysop = true;
                }
            }
        }
        newOption("popupDelay", 0.5);
        newOption("popupHideDelay", 0.5);
        newOption("simplePopups", false);
        newOption("popupStructure", "shortmenus");
        newOption("popupActionsMenu", true);
        newOption("popupSetupMenu", true);
        newOption("popupAdminLinks", userIsSysop);
        newOption("popupShortcutKeys", false);
        newOption("popupHistoricalLinks", true);
        newOption("popupOnlyArticleLinks", true);
        newOption("removeTitles", true);
        newOption("popupMaxWidth", 350);
        newOption("popupSimplifyMainLink", true);
        newOption("popupAppendRedirNavLinks", true);
        newOption("popupTocLinks", false);
        newOption("popupSubpopups", true);
        newOption("popupDragHandle", false);
        newOption("popupLazyPreviews", true);
        newOption("popupLazyDownloads", true);
        newOption("popupAllDabsStubs", false);
        newOption("popupDebugging", false);
        newOption("popupActiveNavlinks", true);
        newOption("popupModifier", false);
        newOption("popupModifierAction", "enable");
        newOption("popupDraggable", true);
        newOption("popupReview", false);
        newOption("popupLocale", false);
        newOption("popupDateTimeFormatterOptions", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        newOption("popupDateFormatterOptions", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        newOption("popupTimeFormatterOptions", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        newOption("popupImages", true);
        newOption("imagePopupsForImages", true);
        newOption("popupNeverGetThumbs", false);
        newOption("popupThumbAction", "imagepage");
        newOption("popupImageSize", 60);
        newOption("popupImageSizeLarge", 200);
        newOption("popupFixRedirs", false);
        newOption("popupRedirAutoClick", "wpDiff");
        newOption("popupFixDabs", false);
        newOption("popupDabsAutoClick", "wpDiff");
        newOption("popupRevertSummaryPrompt", false);
        newOption("popupMinorReverts", false);
        newOption("popupRedlinkRemoval", false);
        newOption("popupRedlinkAutoClick", "wpDiff");
        newOption("popupWatchDisambiggedPages", null);
        newOption("popupWatchRedirredPages", null);
        newOption("popupDabWiktionary", "last");
        newOption("popupNavLinks", true);
        newOption("popupNavLinkSeparator", " &sdot; ");
        newOption("popupLastEditLink", true);
        newOption("popupEditCounterTool", "supercount");
        newOption("popupEditCounterUrl", "");
        newOption("popupPreviews", true);
        newOption("popupSummaryData", true);
        newOption("popupMaxPreviewSentences", 5);
        newOption("popupMaxPreviewCharacters", 600);
        newOption("popupLastModified", true);
        newOption("popupPreviewKillTemplates", true);
        newOption("popupPreviewRawTemplates", true);
        newOption("popupPreviewFirstParOnly", true);
        newOption("popupPreviewCutHeadings", true);
        newOption("popupPreviewButton", false);
        newOption("popupPreviewButtonEvent", "click");
        newOption("popupPreviewDiffs", true);
        newOption("popupDiffMaxLines", 100);
        newOption("popupDiffContextLines", 2);
        newOption("popupDiffContextCharacters", 40);
        newOption("popupDiffDates", true);
        newOption("popupDiffDatePrinter", "toLocaleString");
        newOption("popupReviewedSummary", popupString("defaultpopupReviewedSummary"));
        newOption("popupFixDabsSummary", popupString("defaultpopupFixDabsSummary"));
        newOption("popupExtendedRevertSummary", popupString("defaultpopupExtendedRevertSummary"));
        newOption("popupRevertSummary", popupString("defaultpopupRevertSummary"));
        newOption("popupRevertToPreviousSummary", popupString("defaultpopupRevertToPreviousSummary"));
        newOption("popupQueriedRevertSummary", popupString("defaultpopupQueriedRevertSummary"));
        newOption("popupQueriedRevertToPreviousSummary", popupString("defaultpopupQueriedRevertToPreviousSummary"));
        newOption("popupFixRedirsSummary", popupString("defaultpopupFixRedirsSummary"));
        newOption("popupRedlinkSummary", popupString("defaultpopupRedlinkSummary"));
        newOption("popupRmDabLinkSummary", popupString("defaultpopupRmDabLinkSummary"));
        newOption("popupHistoryLimit", 50);
        newOption("popupFilters", [popupFilterStubDetect, popupFilterDisambigDetect, popupFilterPageSize, popupFilterCountLinks, popupFilterCountImages, popupFilterCountCategories, popupFilterLastModified, popupFilterWikibaseItem]);
        newOption("extraPopupFilters", []);
        newOption("popupOnEditSelection", "cursor");
        newOption("popupPreviewHistory", true);
        newOption("popupImageLinks", true);
        newOption("popupCategoryMembers", true);
        newOption("popupUserInfo", true);
        newOption("popupHistoryPreviewLimit", 25);
        newOption("popupContribsPreviewLimit", 25);
        newOption("popupRevDelUrl", "//en.wikipedia.org/wiki/Wikipedia:Revision_deletion");
        newOption("popupShowGender", true);
        newOption("popupNewWindows", false);
        newOption("popupLinksNewWindow", {
            lastContrib: true,
            sinceMe: true,
        });
        newOption("popupDabRegexp", "disambiguation\\}\\}|\\{\\{\\s*(d(ab|isamb(ig(uation)?)?)|(((geo|hn|road?|school|number)dis)|[234][lc][acw]|(road|ship)index))\\s*(\\|[^}]*)?\\}\\}|is a .*disambiguation.*page");
        newOption("popupAnchorRegexp", "anchors?");
        newOption("popupStubRegexp", "(sect)?stub[}][}]|This .*-related article is a .*stub");
        newOption("popupImageVarsRegexp", "image|image_(?:file|skyline|name|flag|seal)|cover|badge|logo");
    };
