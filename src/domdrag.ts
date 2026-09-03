import { log, pg } from "./globals.ts";
import { imageHTML } from "./htmloutput.ts";
import { navLinksHTML, navlinkStringToHTML } from "./navlinks.ts";
import { getValueOf } from "./options.ts";
// An HTMLElement after Drag.init() has decorated it with drag state.
// The properties are ad-hoc (upstream pattern); they only exist on
// elements that went through init(), which also assigns all of them.
type DragHandle = HTMLElement & {
    dragging: boolean;
    popups_draggable: boolean;
    hmode: boolean;
    vmode: boolean;
    root: DragHandle;
    lastMouseX: number;
    lastMouseY: number;
    onmousemoveDefault: GlobalEventHandlers["onmousemove"];
    onthisStart: (x?: number, y?: number) => void;
    onthisEnd: () => void;
    onthis: (x?: number, y?: number) => void;
};
export class Drag {
    obj!: DragHandle;
    startCondition: ((e: MouseEvent) => boolean) | null = null;
    endHook: ((x: number | undefined, y: number | undefined) => void) | null = null;
    fixE = (_e?: MouseEvent) => {
        let e = _e;
        if (typeof e === "undefined") {
            // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy window.event fallback is upstream behavior
            e = window.event as MouseEvent | undefined;
        }
        if (!e) {
            return e;
        }
        // lib.dom declares layerX/layerY as always-present and read-only;
        // upstream patches them for legacy browsers, so go through a
        // mutable view of the same object
        const legacy = e as unknown as { layerX?: number; layerY?: number; offsetX: number; offsetY: number };
        if (typeof legacy.layerX === "undefined") {
            legacy.layerX = legacy.offsetX;
        }
        if (typeof legacy.layerY === "undefined") {
            legacy.layerY = legacy.offsetY;
        }
        return e;
    };
    init(o: HTMLElement, oRoot: HTMLElement) {
        const obj = o as DragHandle;
        this.obj = obj;
        obj.onmousedown = (e) => {
            this.start.bind(this)(e);
        };
        obj.dragging = false;
        obj.popups_draggable = true;
        obj.hmode = true;
        obj.vmode = true;
        obj.root = oRoot as DragHandle;
        if (isNaN(parseInt(obj.root.style.left, 10))) {
            obj.root.style.left = "0px";
        }
        if (isNaN(parseInt(obj.root.style.top, 10))) {
            obj.root.style.top = "0px";
        }
        obj.root.onthisStart = () => { /* no-op by design */ };
        obj.root.onthisEnd = () => { /* no-op by design */ };
        obj.root.onthis = () => { /* no-op by design */ };
    }
    start(_e?: MouseEvent) {
        let e = _e;
        const o = this.obj;
        e = this.fixE(e);
        if (!e) {
            return;
        }
        if (this.startCondition && !this.startCondition(e)) {
            return;
        }
        const y = parseInt(o.vmode ? o.root.style.top : o.root.style.bottom, 10);
        const x = parseInt(o.hmode ? o.root.style.left : o.root.style.right, 10);
        o.root.onthisStart(x, y);
        o.lastMouseX = e.clientX;
        o.lastMouseY = e.clientY;
        o.onmousemoveDefault = document.onmousemove;
        o.dragging = true;
        document.onmousemove = (e) => {
            this.drag.bind(this)(e);
        };
        document.onmouseup = () => {
            this.end.bind(this)();
        };
        return false;
    }
    drag(_e?: MouseEvent) {
        let e = _e;
        e = this.fixE(e);
        if (!e) {
            return;
        }
        const o = this.obj;
        const ey = e.clientY;
        const ex = e.clientX;
        const y = parseInt(o.vmode ? o.root.style.top : o.root.style.bottom, 10);
        const x = parseInt(o.hmode ? o.root.style.left : o.root.style.right, 10);
        const nx = x + (ex - o.lastMouseX) * (o.hmode ? 1 : -1);
        const ny = y + (ey - o.lastMouseY) * (o.vmode ? 1 : -1);
        this.obj.root.style[o.hmode ? "left" : "right"] = `${nx}px`;
        this.obj.root.style[o.vmode ? "top" : "bottom"] = `${ny}px`;
        this.obj.lastMouseX = ex;
        this.obj.lastMouseY = ey;
        this.obj.root.onthis(nx, ny);
        return false;
    }
    end() {
        document.onmousemove = this.obj.onmousemoveDefault;
        document.onmouseup = null;
        this.obj.dragging = false;
        if (this.endHook) {
            this.endHook(parseInt(this.obj.root.style[this.obj.hmode ? "left" : "right"], 10), parseInt(this.obj.root.style[this.obj.vmode ? "top" : "bottom"], 10));
        }
    }
}
pg.structures.original = {};
pg.structures.original.popupLayout = () => ["popupError", "popupImage", "popupTopLinks", "popupTitle", "popupUserData", "popupData", "popupOtherLinks", "popupRedir", ["popupWarnRedir", "popupRedirTopLinks", "popupRedirTitle", "popupRedirData", "popupRedirOtherLinks"], "popupMiscTools", ["popupRedlink"], "popupPrePreviewSep", "popupPreview", "popupSecondPreview", "popupPreviewMore", "popupPostPreview", "popupFixDab"];
pg.structures.original.popupRedirSpans = () => ["popupRedir", "popupWarnRedir", "popupRedirTopLinks", "popupRedirTitle", "popupRedirData", "popupRedirOtherLinks"];
pg.structures.original.popupTitle = (x) => {
    log("defaultstructure.popupTitle");
    if (!getValueOf("popupNavLinks")) {
        return navlinkStringToHTML("<b><<mainlink>></b>", x.article, x.params);
    }
    return "";
};
pg.structures.original.popupTopLinks = (x) => {
    log("defaultstructure.popupTopLinks");
    if (getValueOf("popupNavLinks")) {
        return navLinksHTML(x.article, x.hint, x.params);
    }
    return "";
};
pg.structures.original.popupImage = (x) => {
    log(`original.popupImage, x.article=${String(x.article)}, x.navpop?.idNumber=${String(x.navpop?.idNumber)}`);
    return imageHTML(x.article, x.navpop?.idNumber);
};
pg.structures.original.popupRedirTitle = pg.structures.original.popupTitle;
pg.structures.original.popupRedirTopLinks = pg.structures.original.popupTopLinks;
