import type { Pg, WikiInfo } from "./types/pg.ts";

export const pg: Pg = {
    api: {},
    re: {},
    ns: {},
    string: {},
    // filled in by init.ts at setup time
    wiki: {} as WikiInfo,
    user: {},
    misc: {},
    option: {},
    optionDefault: {},
    flag: {},
    cache: { pages: [] },
    structures: {},
    timer: {},
    counter: {},
    current: { links: [], linksHash: {} },
    fn: {},
    endoflist: null,
    idNumber: 0,
};

/*
 * Bail if another popups script is already loaded. An element with id "pg"
 * would add a window.pg property, ignore such property. The original code
 * returned from the jQuery-ready wrapper at this exact spot (right after the
 * pg literal); ES modules cannot return early, so the guard becomes a flag
 * that gates the global side effects: the window.pg assignment here and the
 * jQuery-ready/hook registration in entry.ts.
 */
export const alreadyLoaded = !!(window.pg && !(window.pg instanceof HTMLElement));
if (!alreadyLoaded) {
    window.pg = pg;
}

// Runtime feature detection: older MediaWiki installs may lack escapeRegExp
// (typed as always present upstream), and mw.RegExp.escape is deprecated but
// is precisely the fallback the upstream code relies on.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- types mark it always-present; the runtime fallback is upstream behavior
if (!mw.util.escapeRegExp) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- upstream fallback, revisit on the next upstream sync
    mw.util.escapeRegExp = mw.RegExp.escape;
}
export const log = (...args: unknown[]): void => {
    if (window.popupDebug) {
        console.log(...args);
    }
};
export const errlog = (...args: unknown[]): void => {
    if (window.popupDebug) {
        console.error(...args);
    }
};
