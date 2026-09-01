// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { removeModifierKeyHandler, restoreTitle } from "./actions.ts";
import { pg } from "./globals.ts";
import { Navpopup } from "./navpopup.ts";
import { getValueOf } from "./options.ts";
    const fuzzyCursorOffMenus = (x, y, fuzz, parent) => {
        if (!parent) {
            return null;
        }
        const uls = parent.getElementsByTagName("ul");
        for (let i = 0; i < uls.length; ++i) {
            if (uls[i].className === "popup_menu") {
                if (uls[i].offsetWidth > 0) {
                    return false;
                }
            }
        }
        return true;
    };
    export const checkPopupPosition = () => {
        if (pg.current.link && pg.current.link.navpopup) {
            pg.current.link.navpopup.limitHorizontalPosition();
        }
    };
    export function mouseOutWikiLink() {
        const a = this;
        removeModifierKeyHandler(a);
        if (a.navpopup === null || typeof a.navpopup === "undefined") {
            return;
        }
        if (!a.navpopup.isVisible()) {
            a.navpopup.banish();
            return;
        }
        restoreTitle(a);
        Navpopup.tracker.addHook(posCheckerHook(a.navpopup));
    }
    export const posCheckerHook = (navpop) => () => {
        if (!navpop.isVisible()) {
            return true;
        }
        if (Navpopup.tracker.dirty) {
            return false;
        }
        const x = Navpopup.tracker.x,
            y = Navpopup.tracker.y;
        const mouseOverNavpop = navpop.isWithin(x, y, navpop.fuzz, navpop.mainDiv) || !fuzzyCursorOffMenus(x, y, navpop.fuzz, navpop.mainDiv);
        let t = getValueOf("popupHideDelay");
        if (t) {
            t = t * 1e3;
        }
        if (!t) {
            if (!mouseOverNavpop) {
                if (navpop.parentAnchor) {
                    restoreTitle(navpop.parentAnchor);
                }
                navpop.banish();
                return true;
            }
            return false;
        }
        const d = +new Date();
        if (!navpop.mouseLeavingTime) {
            navpop.mouseLeavingTime = d;
            return false;
        }
        if (mouseOverNavpop) {
            navpop.mouseLeavingTime = null;
            return false;
        }
        if (d - navpop.mouseLeavingTime > t) {
            navpop.mouseLeavingTime = null;
            navpop.banish();
            return true;
        }
        return false;
    };
    export const runStopPopupTimer = (navpop) => {
        if (!navpop.stopPopupTimer) {
            navpop.stopPopupTimer = setInterval(posCheckerHook(navpop), 500);
            navpop.addHook(() => {
                clearInterval(navpop.stopPopupTimer);
            }, "hide", "before");
        }
    };
