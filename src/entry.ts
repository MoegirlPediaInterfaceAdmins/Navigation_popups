// Entry point. Imports are ordered exactly like the fragments of the original
// single-file gadget: module bodies run in this order, which the top-level
// side-effect chain (pg.structures population in domdrag -> structures, the
// String.prototype.parenSplit polyfill, the pg.string table, ...) relies on.
// Named imports double as side-effect imports for their modules; the rest are
// imported for their side effects only.
import { alreadyLoaded, pg } from "./globals.ts";
import "./popupStrings.ts";
import { setupTooltips } from "./actions.ts";
import "./domdrag.ts";
import "./structures.ts";
import "./autoedit.ts";
import "./downloader.ts";
import "./livepreview.ts";
import "./pageinfo.ts";
import "./titles.ts";
import "./getpage.ts";
import "./parensplit.ts";
import "./tools.ts";
import "./dab.ts";
import "./htmloutput.ts";
import { posCheckerHook } from "./mouseout.ts";
import "./previewmaker.ts";
import "./querypreview.ts";
import "./debug.ts";
import "./images.ts";
import "./namespaces.ts";
import "./selpop.ts";
import { Navpopup } from "./navpopup.ts";
import "./diff.ts";
import { setupPopups } from "./init.ts";
import "./navlinks.ts";
import "./shortcutkeys.ts";
import "./diffpreview.ts";
import "./links.ts";
import "./options.ts";
import "./strings.ts";
import { run } from "./run.ts";

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
