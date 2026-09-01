// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { log, pg } from "./globals.ts";
import { imageHTML } from "./htmloutput.ts";
import { navLinksHTML, navlinkStringToHTML } from "./navlinks.ts";
import { getValueOf } from "./options.ts";
    export class Drag {
        startCondition = null;
        endHook = null;
        fixE = (_e) => {
            let e = _e;
            if (typeof e === "undefined") {
                e = window.event;
            }
            if (typeof e.layerX === "undefined") {
                e.layerX = e.offsetX;
            }
            if (typeof e.layerY === "undefined") {
                e.layerY = e.offsetY;
            }
            return e;
        };
        init(o, oRoot) {
            const dragObj = this;
            this.obj = o;
            o.onmousedown = (e) => {
                dragObj.start.bind(dragObj)(e);
            };
            o.dragging = false;
            o.popups_draggable = true;
            o.hmode = true;
            o.vmode = true;
            o.root = oRoot || o;
            if (isNaN(parseInt(o.root.style.left, 10))) {
                o.root.style.left = "0px";
            }
            if (isNaN(parseInt(o.root.style.top, 10))) {
                o.root.style.top = "0px";
            }
            o.root.onthisStart = () => { };
            o.root.onthisEnd = () => { };
            o.root.onthis = () => { };
        }
        start(_e) {
            let e = _e;
            const o = this.obj;
            e = this.fixE(e);
            if (this.startCondition && !this.startCondition(e)) {
                return;
            }
            const y = parseInt(o.vmode ? o.root.style.top : o.root.style.bottom, 10);
            const x = parseInt(o.hmode ? o.root.style.left : o.root.style.right, 10);
            o.root.onthisStart(x, y);
            o.lastMouseX = e.clientX;
            o.lastMouseY = e.clientY;
            const dragObj = this;
            o.onmousemoveDefault = document.onmousemove;
            o.dragging = true;
            document.onmousemove = (e) => {
                dragObj.drag.bind(dragObj)(e);
            };
            document.onmouseup = (e) => {
                dragObj.end.bind(dragObj)(e);
            };
            return false;
        }
        drag(_e) {
            let e = _e;
            e = this.fixE(e);
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
        log(`original.popupImage, x.article=${x.article}, x.navpop.idNumber=${x.navpop.idNumber}`);
        return imageHTML(x.article, x.navpop.idNumber);
    };
    pg.structures.original.popupRedirTitle = pg.structures.original.popupTitle;
    pg.structures.original.popupRedirTopLinks = pg.structures.original.popupTopLinks;
