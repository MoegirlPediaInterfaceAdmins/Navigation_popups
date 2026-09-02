import { Drag } from "./domdrag.ts";
    import type { Downloader } from "./downloader.ts";
    import type { Title } from "./titles.ts";
    import type { DiffSide } from "./diffpreview.ts";
import { log } from "./globals.ts";
import { Mousetracker } from "./selpop.ts";
    export class Navpopup {
        static uid = 0;
        static highest = 1e3;
        static tracker = new Mousetracker();
        uid = Navpopup.uid++;
        visible = false;
        noshow = false;
        hooks: Record<string, ({
            hook: (this: Navpopup) => boolean | void;
            when: string;
            hookId: string | null;
        } | null)[]> = {
            create: [],
            unhide: [],
            hide: [],
        };
        hookIds: Record<string, boolean> = {};
        downloads: Downloader[] = [];
        stable_x = 0;
        stable_y = 0;
        showSoonStableTimer?: number;
        className?: string;
        pending: number | null = null;
        fuzz = 5;
        constrained = true;
        width = 0;
        height = 0;
        mainDiv!: HTMLDivElement;
        left?: number;
        top?: number;
        tooWide?: boolean;
        maxWidth?: number;
        article?: Title;
        originalArticle?: Title;
        // per-popup diff state, filled by diffpreview.ts (loadDiff/doneDiff)
        diffData?: { oldRev: DiffSide; newRev: DiffSide };
        parentPopup?: Navpopup | null;
        parentAnchor?: HTMLAnchorElement | null;
        mouseLeavingTime?: number | null;
        stopPopupTimer?: number;
        idNumber?: number;
        delay = 0;
        hasPopupMenu?: boolean;
        // redirect-following state driven by actions.ts loadPreviewFromRedir
        redir = 0;
        redirTarget?: Title;
        constructor() {
            this.createMainDiv();
        }
        isVisible() {
            return this.visible;
        }
        reposition(x?: number | null, y?: number | null, noLimitHor?: boolean) {
            log(`reposition(${x},${y},${noLimitHor})`);
            if (typeof x !== "undefined" && x !== null) {
                this.left = x;
            }
            if (typeof y !== "undefined" && y !== null) {
                this.top = y;
            }
            if (typeof this.left !== "undefined" && typeof this.top !== "undefined") {
                this.mainDiv.style.left = `${this.left}px`;
                this.mainDiv.style.top = `${this.top}px`;
            }
            if (!noLimitHor) {
                this.limitHorizontalPosition();
            }
        }
        limitHorizontalPosition() {
            if (!this.constrained || this.tooWide) {
                return;
            }
            this.updateDimensions();
            const x = this.left ?? Number.NaN;
            const w = this.width;
            const cWidth = document.body.clientWidth;
            if (x + w >= cWidth || x > 0 && this.maxWidth && this.width < this.maxWidth && this.height > this.width && x > cWidth - (this.maxWidth ?? Number.NaN)) {
                this.mainDiv.style.left = "-10000px";
                this.mainDiv.style.width = `${this.maxWidth}px`;
                const naturalWidth = parseInt(String(this.mainDiv.offsetWidth), 10);
                let newLeft = cWidth - naturalWidth - 1;
                if (newLeft < 0) {
                    newLeft = 0;
                    this.tooWide = true;
                }
                log(`limitHorizontalPosition: moving to (${newLeft},${this.top}); naturalWidth=${naturalWidth}, clientWidth=${cWidth}`);
                this.reposition(newLeft, null, true);
            }
        }
        raise() {
            this.mainDiv.style.zIndex = String(Navpopup.highest + 1);
            ++Navpopup.highest;
        }
        show() {
            if (this.noshow) {
                return;
            }
            this.reposition();
            this.raise();
            this.unhide();
        }
        showSoonIfStable(time: number) {
            log(`showSoonIfStable, time=${time}`);
            if (this.visible) {
                return;
            }
            this.noshow = false;
            this.stable_x = -1e4;
            this.stable_y = -1e4;
            const stableShow = () => {
                log("stableShow called");
                const new_x = Navpopup.tracker.x, new_y = Navpopup.tracker.y;
                const dx = this.stable_x - (new_x ?? Number.NaN), dy = this.stable_y - (new_y ?? Number.NaN);
                const fuzz2 = 0;
                if (dx * dx <= fuzz2 && dy * dy <= fuzz2) {
                    log("mouse is stable");
                    clearInterval(this.showSoonStableTimer);
                    this.reposition.bind(this)((new_x ?? 0) + 2, (new_y ?? 0) + 2);
                    this.show.bind(this)();
                    this.limitHorizontalPosition.bind(this)();
                    return;
                }
                this.stable_x = new_x ?? Number.NaN;
                this.stable_y = new_y ?? Number.NaN;
            };
            this.showSoonStableTimer = setInterval(stableShow, time / 2);
        }
        banish() {
            log("banish called");
            this.noshow = true;
            if (this.showSoonStableTimer) {
                log("clearing showSoonStableTimer");
                clearInterval(this.showSoonStableTimer);
            }
            this.hide();
        }
        runHooks(key: string, when?: string) {
            if (!this.hooks[key]) {
                return;
            }
            const keyHooks = this.hooks[key];
            const len = keyHooks.length;
            for (let i = 0; i < len; ++i) {
                const entry = keyHooks[i];
                if (entry && entry.when === when) {
                    if (entry.hook.bind(this)()) {
                        if (entry.hookId) {
                            Reflect.deleteProperty(this.hookIds, entry.hookId);
                        }
                        keyHooks[i] = null;
                    }
                }
            }
        }
        addHook(hook: () => boolean | void, key: string, _when?: string, uid?: string) {
            const when = _when || "after";
            if (!this.hooks[key]) {
                return;
            }
            let hookId = null;
            if (uid) {
                hookId = [key, when, uid].join("|");
                if (this.hookIds[hookId]) {
                    return;
                }
                this.hookIds[hookId] = true;
            }
            this.hooks[key].push({
                hook: hook,
                when: when,
                hookId: hookId,
            });
        }
        createMainDiv() {
            this.runHooks("create", "before");
            const mainDiv = document.createElement("div");
            const savedThis = this;
            mainDiv.onclick = (e) => {
                savedThis.onclickHandler(e);
            };
            mainDiv.className = this.className ? this.className : "navpopup_maindiv";
            mainDiv.id = mainDiv.className + this.uid;
            mainDiv.style.position = "absolute";
            mainDiv.style.minWidth = "350px";
            mainDiv.style.display = "none";
            mainDiv.className = "navpopup";
            mainDiv.navpopup = this;
            this.mainDiv = mainDiv;
            document.body.appendChild(mainDiv);
            this.runHooks("create", "after");
        }
        onclickHandler(_e?: MouseEvent) {
            this.raise();
        }
        makeDraggable(handleName?: string | null) {
            const drag = new Drag();
            if (!handleName) {
                drag.startCondition = (e) => {
                    try {
                        if (!e.shiftKey) {
                            return false;
                        }
                    } catch (err) {
                        return false;
                    }
                    return true;
                };
            }
            let dragHandle: HTMLElement | null = null;
            if (handleName) {
                dragHandle = document.getElementById(handleName);
            }
            if (!dragHandle) {
                dragHandle = this.mainDiv;
            }
            const np = this;
            drag.endHook = (x, y) => {
                Navpopup.tracker.dirty = true;
                np.reposition(x, y);
            };
            drag.init(dragHandle, this.mainDiv);
        }
        hide() {
            this.runHooks("hide", "before");
            this.abortDownloads();
            if (this.visible) {
                this.mainDiv.style.display = "none";
                this.visible = false;
            }
            this.runHooks("hide", "after");
        }
        unhide() {
            this.runHooks("unhide", "before");
            if (!this.visible) {
                this.mainDiv.style.display = "inline";
                this.visible = true;
            }
            this.runHooks("unhide", "after");
        }
        setInnerHTML(html: string) {
            this.mainDiv.innerHTML = html;
        }
        updateDimensions() {
            this.width = parseInt(String(this.mainDiv.offsetWidth), 10);
            this.height = parseInt(String(this.mainDiv.offsetHeight), 10);
        }
        isWithin(x?: number, y?: number, _fuzz?: number, _parent?: HTMLElement | null) {
            if (!this.visible) {
                return false;
            }
            this.updateDimensions();
            const fuzz = this.fuzz || 0;
            const left = this.left ?? Number.NaN;
            const top = this.top ?? Number.NaN;
            return (x ?? Number.NaN) + fuzz >= left && (x ?? Number.NaN) - fuzz <= left + this.width && (y ?? Number.NaN) + fuzz >= top && (y ?? Number.NaN) - fuzz <= top + this.height;
        }
        addDownload(download: Downloader) {
            if (!download) {
                return;
            }
            this.downloads.push(download);
        }
        abortDownloads() {
            for (let i = 0; i < this.downloads.length; ++i) {
                const d = this.downloads[i];
                if (d && d.abort) {
                    d.abort();
                }
            }
            this.downloads = [];
        }
    }
