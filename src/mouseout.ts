import { removeModifierKeyHandler, restoreTitle } from "./actions.ts";
import { pg } from "./globals.ts";
import { Navpopup } from "./navpopup.ts";
import { getValueOf } from "./options.ts";
const fuzzyCursorOffMenus = (_x: number | undefined, _y: number | undefined, _fuzz: number, parent: HTMLElement | null) => {
    if (!parent) {
        return null;
    }
    const uls = parent.getElementsByTagName("ul");
    for (const ul of uls) {
        if (ul.className === "popup_menu") {
            if (ul.offsetWidth > 0) {
                return false;
            }
        }
    }
    return true;
};
export const checkPopupPosition = () => {
    if (pg.current.link?.navpopup) {
        pg.current.link.navpopup.limitHorizontalPosition();
    }
};
export function mouseOutWikiLink(this: GlobalEventHandlers) {
    const a = this as HTMLAnchorElement;
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
export const posCheckerHook = (navpop: Navpopup) => () => {
    if (!navpop.isVisible()) {
        return true;
    }
    if (Navpopup.tracker.dirty) {
        return false;
    }
    const x = Navpopup.tracker.x,
        y = Navpopup.tracker.y;
    const mouseOverNavpop = navpop.isWithin(x, y) || !fuzzyCursorOffMenus(x, y, navpop.fuzz, navpop.mainDiv);
    let t = getValueOf("popupHideDelay");
    if (t) {
        t = (t as number) * 1e3;
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
    if (d - navpop.mouseLeavingTime > (t as number)) {
        navpop.mouseLeavingTime = null;
        navpop.banish();
        return true;
    }
    return false;
};
export const runStopPopupTimer = (navpop: Navpopup) => {
    if (!navpop.stopPopupTimer) {
        navpop.stopPopupTimer = setInterval(posCheckerHook(navpop), 500);
        navpop.addHook(() => {
            clearInterval(navpop.stopPopupTimer);
        }, "hide", "before");
    }
};
