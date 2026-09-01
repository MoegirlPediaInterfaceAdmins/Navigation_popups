import type { Pg } from "./types/pg.ts";

export const pg: Pg = {
    api: {},
    re: {},
    ns: {},
    string: {},
    wiki: {},
    user: {},
    misc: {},
    option: {},
    optionDefault: {},
    flag: {},
    cache: {},
    structures: {},
    timer: {},
    counter: {},
    current: {},
    fn: {},
    endoflist: null,
};

/*
 * Bail if another popups script is already loaded. An element with id "pg"
 * would add a window.pg property, ignore such property. The original code
 * returned from the jQuery-ready wrapper at this exact spot (right after the
 * pg literal); ES modules cannot return early, so the guard becomes a flag
 * that gates the global side effects: the window.pg assignment here and the
 * jQuery-ready/hook registration in entry.ts.
 */
export const alreadyLoaded = Boolean(window.pg && !(window.pg instanceof HTMLElement));
if (!alreadyLoaded) {
    window.pg = pg;
}

// Runtime feature detection: older MediaWiki installs may lack escapeRegExp
// (typed as always present upstream), and mw.RegExp.escape is deprecated but
// is precisely the fallback the upstream code relies on.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
