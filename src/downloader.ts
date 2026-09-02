import { pg } from "./globals.ts";
    import type { Navpopup } from "./navpopup.ts";
    export class Downloader {
        id: number | string | null = null;
        lastModified: Date | string | null = null;
        callbackFunction: ((downloader: Downloader) => void) | null = null;
        onFailure: ((downloader: Downloader) => void) | null = null;
        aborted = false;
        method = "GET";
        async = true;
        http?: XMLHttpRequest;
        url: string;
        data?: string;
        owner?: Navpopup | null;
        // set by querypreview once the wikibase item of the page is known
        wikibaseItem?: string;
        wikibaseRepo?: string;
        constructor(url: string) {
            if (typeof XMLHttpRequest !== "undefined") {
                this.http = new XMLHttpRequest();
            }
            this.url = url;
        }
        send(x: string | null) {
            if (!this.http) {
                return null;
            }
            return this.http.send(x);
        }
        abort() {
            if (!this.http) {
                return null;
            }
            this.aborted = true;
            return this.http.abort();
        }
        getData() {
            if (!this.http) {
                return null;
            }
            return this.http.responseText;
        }
        setTarget() {
            if (!this.http) {
                return null;
            }
            this.http.open(this.method, this.url, this.async);
            this.http.setRequestHeader("Api-User-Agent", pg.api.userAgent ?? "");
        }
        getReadyState() {
            if (!this.http) {
                return null;
            }
            return this.http.readyState;
        }
        start() {
            if (!this.http) {
                return;
            }
            (pg.misc.downloadsInProgress ??= {})[String(this.id)] = this;
            this.http.send(null);
        }
        getLastModifiedDate() {
            if (!this.http) {
                return null;
            }
            let lastmod = null;
            try {
                lastmod = this.http.getResponseHeader("Last-Modified");
            } catch { }
            if (lastmod) {
                return new Date(lastmod);
            }
            return null;
        }
        setCallback(f: () => void) {
            if (!this.http) {
                return;
            }
            this.http.onreadystatechange = f;
        }
        getStatus() {
            if (!this.http) {
                return null;
            }
            return this.http.status;
        }
    }
    pg.misc.downloadsInProgress = {};
    const newDownload = (url: string, id: number | string | ((d: Downloader) => void) | null | undefined, callback?: (d: Downloader) => void, _onfailure?: number | ((d: Downloader, url: string, id: number | undefined, callback?: (d: Downloader) => void) => void)): Downloader | string => {
        let onfailure = _onfailure;
        const d = new Downloader(url);
        if (!d.http) {
            return "ohdear";
        }
        d.id = typeof id === "number" ? id : null;
        d.setTarget();
        if (!onfailure) {
            onfailure = 2;
        }
        const f = function (this: XMLHttpRequest) {
            if (d.getReadyState() === 4) {
                Reflect.deleteProperty(pg.misc.downloadsInProgress ?? {}, String((this as unknown as { id?: number }).id));
                try {
                    if (d.getStatus() === 200) {
                        d.data = d.getData() ?? undefined;
                        d.lastModified = d.getLastModifiedDate() as Date | null;
                        callback?.(d);
                    } else if (typeof onfailure === "number") {
                        if (onfailure > 0) {
                            newDownload(url, id, callback, onfailure - 1);
                        }
                    } else if (typeof onfailure === "function") {
                        onfailure(d, url, typeof id === "number" ? id : undefined, callback);
                    }
                } catch { }
            }
        };
        d.setCallback(f);
        return d;
    };
    export const fakeDownload = (url: string, id: number | undefined, callback: (d: Downloader) => void, data?: string, lastModified?: Date | string | null, owner?: Navpopup | null) => {
        const d = newDownload(url, callback);
        if (typeof d === "string") {
            return;
        }
        d.owner = owner;
        d.id = id ?? null;
        d.data = data ?? undefined;
        d.lastModified = lastModified ?? null;
        return callback(d);
    };
    export const startDownload = (url: string, id: number | string | null | undefined, callback: (d: Downloader) => void): Downloader | string => {
        const d = newDownload(url, id, callback);
        if (typeof d === "string") {
            return d;
        }
        d.start();
        return d;
    };
    export const abortAllDownloads = () => {
        for (const x in pg.misc.downloadsInProgress) {
            try {
                pg.misc.downloadsInProgress[x].aborted = true;
                pg.misc.downloadsInProgress[x].abort();
                Reflect.deleteProperty(pg.misc.downloadsInProgress, x);
            } catch { }
        }
    };
