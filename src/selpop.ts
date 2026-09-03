import { mouseOverWikiLink2 } from "./actions.ts";
import { pg } from "./globals.ts";
import { popTipsSoonFn } from "./htmloutput.ts";
import { wiki2html } from "./livepreview.ts";
import { runStopPopupTimer } from "./mouseout.ts";
import { getValueOf } from "./options.ts";
import { Title } from "./titles.ts";
const getEditboxSelection = (): string => {
    let editbox: HTMLTextAreaElement | undefined;
    try {
        editbox = document.editform?.wpTextbox1;
    } catch {
        return "";
    }
    if (document.selection) {
        return document.selection.createRange().text;
    }
    if (!editbox) {
        return "";
    }
    const selStart = editbox.selectionStart;
    const selEnd = editbox.selectionEnd;
    return editbox.value.substring(selStart, selEnd);
};
export const doSelectionPopup = () => {
    const sel = getEditboxSelection();
    const open = sel.indexOf("[[");
    const pipe = sel.indexOf("|");
    const close = sel.indexOf("]]");
    if (open === -1 || pipe === -1 && close === -1) {
        return;
    }
    if (pipe !== -1 && open > pipe || close !== -1 && open > close) {
        return;
    }
    const article = new Title(sel.substring(open + 2, pipe < 0 ? close : pipe));
    if (getValueOf("popupOnEditSelection") === "boxpreview") {
        doSeparateSelectionPopup(sel);
        return;
    }
    if (close > 0 && sel.substring(close + 2).includes("[[")) {
        return;
    }
    const a = document.createElement("a");
    a.href = pg.wiki.titlebase + article.urlString();
    mouseOverWikiLink2(a);
    const navpop = a.navpopup;
    if (navpop) {
        navpop.addHook(() => {
            runStopPopupTimer(navpop);
        }, "unhide", "after");
    }
};
const doSeparateSelectionPopup = (str: string) => {
    let div = document.getElementById("selectionPreview");
    if (!div) {
        div = document.createElement("div");
        div.id = "selectionPreview";
        try {
            const box = document.editform?.wpTextbox1;
            if (!box?.parentNode) {
                return;
            }
            box.parentNode.insertBefore(div, box);
        } catch {
            return;
        }
    }
    div.innerHTML = wiki2html(str);
    div.ranSetupTooltipsAlready = false;
    popTipsSoonFn("selectionPreview")();
};
type MousetrackFn = (x?: number, y?: number) => boolean | undefined;
export class Mousetracker {
    x?: number;
    y?: number;
    loopDelay = 400;
    timer: number | null = null;
    active = false;
    dirty = true;
    hooks: MousetrackFn[] = [];
    lastHook_x?: number;
    lastHook_y?: number;
    savedHandler?: GlobalEventHandlers["onmousemove"];
    addHook(f: MousetrackFn) {
        this.hooks.push(f);
    }
    runHooks() {
        if (!this.hooks.length) {
            return;
        }
        let remove = false;
        const removeObj: Record<number, boolean> = {};
        const x = this.x, y = this.y, len = this.hooks.length;
        for (let i = 0; i < len; ++i) {
            if (this.hooks[i](x, y) === true) {
                remove = true;
                removeObj[i] = true;
            }
        }
        if (remove) {
            this.removeHooks(removeObj);
        }
    }
    removeHooks(removeObj: Record<number, boolean>) {
        const newHooks: MousetrackFn[] = [];
        const len = this.hooks.length;
        for (let i = 0; i < len; ++i) {
            if (!removeObj[i]) {
                newHooks.push(this.hooks[i]);
            }
        }
        this.hooks = newHooks;
    }
    track(_e?: MouseEvent) {
        let e = _e;
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy window.event fallback is upstream behavior
        e ??= window.event as MouseEvent | undefined;
        let x: number, y: number;
        if (e) {
            if (e.pageX) {
                x = e.pageX;
                y = e.pageY;
            } else if (typeof e.clientX !== "undefined") {
                const docElt = document.documentElement;
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- 0 offsets fall through to the next fallback; the || chain is deliberate
                const left = docElt.scrollLeft || document.body.scrollLeft || document.scrollLeft || 0;
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- 0 offsets fall through to the next fallback; the || chain is deliberate
                const top = docElt.scrollTop || document.body.scrollTop || document.scrollTop || 0;
                x = e.clientX + left;
                y = e.clientY + top;
            } else {
                return;
            }
            this.setPosition(x, y);
        }
    }
    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        if (this.dirty || this.hooks.length === 0) {
            this.dirty = false;
            return;
        }
        if (typeof this.lastHook_x !== "number" || typeof this.lastHook_y !== "number") {
            this.lastHook_x = -100;
            this.lastHook_y = -100;
        }
        let diff = (this.lastHook_x - x) * (this.lastHook_y - y);
        diff = diff >= 0 ? diff : -diff;
        if (diff > 1) {
            this.lastHook_x = x;
            this.lastHook_y = y;
            this.runHooks();
        }
    }
    enable() {
        if (this.active) {
            return;
        }
        this.active = true;
        this.savedHandler = document.onmousemove;
        document.onmousemove = (e) => {
            this.track.bind(this)(e);
        };
        if (this.loopDelay) {
            this.timer = setInterval(() => {
                this.runHooks();
            }, this.loopDelay);
        }
    }
    disable() {
        if (!this.active) {
            return;
        }
        if (typeof this.savedHandler === "function") {
            document.onmousemove = this.savedHandler;
        } else {
            Reflect.deleteProperty(document, "onmousemove");
        }
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.active = false;
    }
}
