// Entry point. Imports are ordered exactly like the fragments of the original
// single-file gadget: module bodies run in this order, which the top-level
// side-effect chain (pg.structures population in domdrag -> structures, the
// String.prototype.parenSplit polyfill, the pg.string table, ...) relies on.
// Named imports double as side-effect imports for their modules; the rest are
// imported for their side effects only.
import { alreadyLoaded, pg } from "./globals.ts";
import { setupTooltips } from "./modules/actions.ts";
import "./modules/autoedit.ts";
import "./modules/dab.ts";
import "./modules/debug.ts";
import "./modules/diff.ts";
import "./modules/diffpreview.ts";
import "./modules/domdrag.ts";
import "./modules/downloader.ts";
import "./modules/getpage.ts";
import "./modules/htmloutput.ts";
import "./modules/images.ts";
import { setupPopups } from "./modules/init.ts";
import "./modules/links.ts";
import "./modules/livepreview.ts";
import { posCheckerHook } from "./modules/mouseout.ts";
import "./modules/namespaces.ts";
import "./modules/navlinks.ts";
import { Navpopup } from "./modules/navpopup.ts";
import "./modules/options.ts";
import "./modules/pageinfo.ts";
import "./modules/parensplit.ts";
import "./modules/previewmaker.ts";
import "./modules/querypreview.ts";
import { run } from "./modules/run.ts";
import "./modules/selpop.ts";
import "./modules/shortcutkeys.ts";
import "./modules/strings.ts";
import "./modules/structures.ts";
import "./modules/titles.ts";
import "./modules/tools.ts";
import "./popupStrings.ts";

if (!alreadyLoaded) {
    $(() => {
        if (document.readyState === "complete") {
            run();
        } else {
            $(window).on("load", run);
        }
        (() => {
            let once = true;
            const dynamicContentHandler = ($content: JQuery<Element>) => {
                if ($content.attr("id") === "mw-content-text") {
                    if (once) {
                        once = false;
                        return;
                    }
                }
                const registerHooksForVisibleNavpops = () => {
                    // pg.current.links is a loosely-typed domain on pg (see
                    // types/pg.ts); narrow it once instead of unsafe-any chains.
                    const links = pg.current.links as { navpopup?: Navpopup }[] | undefined;
                    for (let i = 0; links && i < links.length; ++i) {
                        const navpop = links[i]?.navpopup;
                        if (!navpop?.isVisible()) {
                            continue;
                        }
                        Navpopup.tracker.addHook(posCheckerHook(navpop));
                    }
                };
                const doIt = () => {
                    registerHooksForVisibleNavpops();
                    $content.each(function (this: Element) {
                        this.ranSetupTooltipsAlready = false;
                        setupTooltips(this);
                    });
                };
                // Fire-and-forget, as in the original run() flow.
                void setupPopups(doIt);
            };
            document
                .querySelectorAll(".mw-parser-output")
                .forEach((content) => {
                    dynamicContentHandler($(content));
                });
            mw.hook("wikipage.content").add(dynamicContentHandler);
            mw.hook("ext.echo.overlay.beforeShowingOverlay").add(($overlay: JQuery<Element>) => {
                dynamicContentHandler($overlay.find(".mw-echo-state"));
            });
        })();
    });
}
