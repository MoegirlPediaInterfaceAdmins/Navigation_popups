// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { mouseOverWikiLink2 } from "./actions.ts";
import { pg } from "./globals.ts";
import { popTipsSoonFn } from "./htmloutput.ts";
import { wiki2html } from "./livepreview.ts";
import { runStopPopupTimer } from "./mouseout.ts";
import { getValueOf } from "./options.ts";
import { Title } from "./titles.ts";
    const getEditboxSelection = () => {
        let editbox;
        try {
            editbox = document.editform.wpTextbox1;
        } catch (dang) {
            return;
        }
        if (document.selection) {
            return document.selection.createRange().text;
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
            return doSeparateSelectionPopup(sel);
        }
        if (close > 0 && sel.substring(close + 2).indexOf("[[") >= 0) {
            return;
        }
        const a = document.createElement("a");
        a.href = pg.wiki.titlebase + article.urlString();
        mouseOverWikiLink2(a);
        if (a.navpopup) {
            a.navpopup.addHook(() => {
                runStopPopupTimer(a.navpopup);
            }, "unhide", "after");
        }
    };
    const doSeparateSelectionPopup = (str) => {
        let div = document.getElementById("selectionPreview");
        if (!div) {
            div = document.createElement("div");
            div.id = "selectionPreview";
            try {
                const box = document.editform.wpTextbox1;
                box.parentNode.insertBefore(div, box);
            } catch (error) {
                return;
            }
        }
        div.innerHTML = wiki2html(str);
        div.ranSetupTooltipsAlready = false;
        popTipsSoonFn("selectionPreview")();
    };
    export class Mousetracker {
        loopDelay = 400;
        timer = null;
        active = false;
        dirty = true;
        hooks = [];
        addHook(f) {
            this.hooks.push(f);
        }
        runHooks() {
            if (!this.hooks || !this.hooks.length) {
                return;
            }
            let remove = false;
            const removeObj = {};
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
        removeHooks(removeObj) {
            const newHooks = [];
            const len = this.hooks.length;
            for (let i = 0; i < len; ++i) {
                if (!removeObj[i]) {
                    newHooks.push(this.hooks[i]);
                }
            }
            this.hooks = newHooks;
        }
        track(_e) {
            let e = _e;
            e ||= window.event;
            let x, y;
            if (e) {
                if (e.pageX) {
                    x = e.pageX;
                    y = e.pageY;
                } else if (typeof e.clientX !== "undefined") {
                    let left, top;
                    const docElt = document.documentElement;
                    if (docElt) {
                        left = docElt.scrollLeft;
                    }
                    left ||= document.body.scrollLeft || document.scrollLeft || 0;
                    if (docElt) {
                        top = docElt.scrollTop;
                    }
                    top ||= document.body.scrollTop || document.scrollTop || 0;
                    x = e.clientX + left;
                    y = e.clientY + top;
                } else {
                    return;
                }
                this.setPosition(x, y);
            }
        }
        setPosition(x, y) {
            this.x = x;
            this.y = y;
            if (this.dirty || this.hooks.length === 0) {
                this.dirty = false;
                return;
            }
            if (typeof this.lastHook_x !== "number") {
                this.lastHook_x = -100;
                this.lastHook_y = -100;
            }
            let diff = (this.lastHook_x - x) * (this.lastHook_y - y);
            diff = diff >= 0 ? diff : -diff;
            if (diff > 1) {
                this.lastHook_x = x;
                this.lastHook_y = y;
                if (this.dirty) {
                    this.dirty = false;
                } else {
                    this.runHooks();
                }
            }
        }
        enable() {
            if (this.active) {
                return;
            }
            this.active = true;
            this.savedHandler = document.onmousemove;
            const savedThis = this;
            document.onmousemove = (e) => {
                savedThis.track.bind(savedThis)(e);
            };
            if (this.loopDelay) {
                this.timer = setInterval(() => {
                    savedThis.runHooks();
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
