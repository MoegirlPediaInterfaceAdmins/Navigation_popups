import { setupTooltips } from "./actions.ts";
import { errlog, log, pg } from "./globals.ts";
import type { Navpopup } from "./navpopup.ts";
import { checkPopupPosition } from "./mouseout.ts";
import { getValueOf } from "./options.ts";
import { Title, parseParams } from "./titles.ts";
import { assume, isString, simplePrintf } from "./tools.ts";
export const setPopupHTML = (str: string | Node | null | undefined, elementId: string, _popupId?: number, onSuccess?: (() => void) | null, append?: boolean) => {
    let popupId = _popupId;
    if (typeof popupId === "undefined") {
        popupId = pg.idNumber;
    }
    const popupElement = document.getElementById(elementId + String(popupId));
    if (popupElement) {
        if (!append) {
            popupElement.innerHTML = "";
        }
        if (isString(str)) {
            popupElement.innerHTML += str;
        } else if (str) {
            popupElement.appendChild(str);
        }
        if (onSuccess) {
            onSuccess();
        }
        setTimeout(checkPopupPosition, 100);
        return true;
    }
    setTimeout(() => {
        setPopupHTML(str, elementId, popupId, onSuccess);
    }, 600);
    return null;
};
export const setPopupTrailer = (str: string | Node | null | undefined, id: number | undefined) => setPopupHTML(str, "popupData", id);
interface FillEmptySpansArgs {
    navpopup: Navpopup;
    redir?: boolean;
    redirTarget?: Title;
    [key: string]: unknown;
}
export const fillEmptySpans = (args: FillEmptySpansArgs) => {
    let redir = true;
    let rcid;
    if (typeof args !== "object" || typeof args.redir === "undefined" || !args.redir) {
        redir = false;
    }
    const a = assume(args.navpopup.parentAnchor);
    let article: Title, hint: string | null = null,
        oldid: string | null = null,
        params: Record<string, string | null> = {};
    if (redir && typeof args.redirTarget === typeof {}) {
        article = assume(args.redirTarget);
    } else {
        article = new Title().fromAnchor(a);
        hint = a.originalTitle || article.hintValue();
        params = parseParams(a.href);
        oldid = getValueOf("popupHistoricalLinks") ? params.oldid : null;
        rcid = params.rcid;
    }
    const x = {
        article: article,
        hint: hint,
        oldid: oldid,
        rcid: rcid,
        navpop: args.navpopup,
        params: params,
    };
    const structure = pg.structures[getValueOf("popupStructure") as string] as typeof pg.structures[string] | undefined;
    if (typeof structure !== "object") {
        setPopupHTML("popupError", `Unknown structure (this should never happen): ${pg.option.popupStructure as string}`, args.navpopup.idNumber);
        return;
    }
    const spans = flatten(pg.misc.layout ?? []) as string[];
    const numspans = spans.length;
    const redirs = pg.misc.redirSpans;
    for (let i = 0; i < numspans; ++i) {
        const found = redirs?.includes(spans[i]);
        if (found && !redir || !found && redir) {
            continue;
        }
        const structurefn = structure[spans[i]];
        if (structurefn === undefined) {
            continue;
        }
        let setfn: (str: string | Node | null, span: string, idnumber?: number) => void;
        if (getValueOf("popupActiveNavlinks") && (spans[i].startsWith("popupTopLinks") || spans[i].startsWith("popupRedirTopLinks"))) {
            setfn = setPopupTipsAndHTML;
        } else {
            setfn = setPopupHTML;
        }
        switch (typeof structurefn) {
            case "function":
                log(`running ${spans[i]}({article:${String(x.article)}, hint:${String(x.hint)}, oldid: ${String(x.oldid)}})`);
                setfn((structurefn as (c: unknown) => string | Node | null)(x), spans[i], args.navpopup.idNumber);
                break;
            case "string":
                setfn(structurefn, spans[i], args.navpopup.idNumber);
                break;
            default:
                errlog(`unknown thing with label ${spans[i]} (span index was ${i})`);
                break;
        }
    }
};
const flatten = (list: unknown[], _start?: number): unknown[] => {
    let start = _start;
    const ret: unknown[] = [];
    if (typeof start === "undefined") {
        start = 0;
    }
    for (let i = start; i < list.length; ++i) {
        if (typeof list[i] === typeof []) {
            return ret.concat(flatten(list[i] as unknown[])).concat(flatten(list, i + 1));
        }
        ret.push(list[i]);
    }
    return ret;
};
export const popupHTML = (a: { navpopup?: Navpopup | null }): string => {
    getValueOf("popupStructure");
    const structure = pg.structures[pg.option.popupStructure as string] as typeof pg.structures[string] | undefined;
    if (typeof structure !== "object") {
        pg.option.popupStructure = pg.optionDefault.popupStructure;
        return popupHTML(a);
    }
    if (typeof structure.popupLayout !== "function") {
        return "Bad layout";
    }
    pg.misc.layout = structure.popupLayout();
    if (typeof structure.popupRedirSpans === "function") {
        pg.misc.redirSpans = (structure.popupRedirSpans as () => string[])();
    } else {
        pg.misc.redirSpans = [];
    }
    const navpop = a.navpopup;
    if (!navpop) {
        return "";
    }
    return makeEmptySpans(pg.misc.layout ?? [], navpop);
};
const makeEmptySpans = (list: unknown[], navpop: Navpopup): string => {
    let ret = "";
    for (const item of list) {
        if (typeof item === typeof "") {
            ret += emptySpanHTML(item as string, navpop.idNumber, "div");
        } else if (typeof item === typeof [] && (item as unknown[]).length > 0) {
            ret = ret.parenSplit(RegExp("(</[^>]*?>$)")).join(makeEmptySpans(item as unknown[], navpop));
        } else if (typeof item === typeof {} && (item as { nodeType?: number }).nodeType) {
            ret += emptySpanHTML(assume((item as { name?: string }).name), navpop.idNumber, (item as { nodeType?: number }).nodeType);
        }
    }
    return ret;
};
type EmptySpanHTMLFn = (name: string, id: number | undefined, _tag?: string | number, _classname?: string) => string;
const emptySpanHTML: EmptySpanHTMLFn & { classAliases: Record<string, string> } = (name, id, _tag, _classname) => {
    let classname = _classname;
    const tag = _tag || "span";
    if (!classname) {
        classname = emptySpanHTML.classAliases[name];
    }
    classname ||= name;
    if (name === getValueOf("popupDragHandle")) {
        classname += " popupDragHandle";
    }
    return simplePrintf('<%s id="%s" class="%s"></%s>', [String(tag), name + String(id), classname, String(tag)]);
};
emptySpanHTML.classAliases = {
    popupSecondPreview: "popupPreview",
};
export const imageHTML = (_article: unknown, idNumber: number | undefined) => simplePrintf('<a id="popupImageLink$1"><img align="right" valign="top" id="popupImg$1" style="display: none;"></img></a>', [String(idNumber)]);
export const popTipsSoonFn = (id: string, _when?: number | null, popData?: { owner?: Navpopup } & Record<string, unknown> | null): () => void => {
    let when = _when;
    if (!when) {
        when = 250;
    }
    const popTips = () => {
        setupTooltips(document.getElementById(id), false, true, popData);
    };
    return () => {
        setTimeout(popTips, when, popData);
    };
};
export const setPopupTipsAndHTML = (html: string | Node | null | undefined, divname: string, idnumber?: number, popData?: { owner?: Navpopup } & Record<string, unknown> | null): void => {
    setPopupHTML(html, divname, idnumber, getValueOf("popupSubpopups") ? popTipsSoonFn(divname + String(idnumber), null, popData) : null);
};
