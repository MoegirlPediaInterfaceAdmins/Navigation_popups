    class Downloader {
        id = null;
        lastModified = null;
        callbackFunction = null;
        onFailure = null;
        aborted = false;
        method = "GET";
        async = true;
        constructor(url) {
            if (typeof XMLHttpRequest !== "undefined") {
                this.http = new XMLHttpRequest();
            }
            this.url = url;
        }
        send(x) {
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
            this.http.setRequestHeader("Api-User-Agent", pg.api.userAgent);
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
            pg.misc.downloadsInProgress[this.id] = this;
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
        setCallback(f) {
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
    const newDownload = (url, id, callback, _onfailure) => {
        let onfailure = _onfailure;
        const d = new Downloader(url);
        if (!d.http) {
            return "ohdear";
        }
        d.id = id;
        d.setTarget();
        if (!onfailure) {
            onfailure = 2;
        }
        const f = function () {
            if (d.getReadyState() === 4) {
                Reflect.deleteProperty(pg.misc.downloadsInProgress, this.id);
                try {
                    if (d.getStatus() === 200) {
                        d.data = d.getData();
                        d.lastModified = d.getLastModifiedDate();
                        callback(d);
                    } else if (typeof onfailure === typeof 1) {
                        if (onfailure > 0) {
                            newDownload(url, id, callback, onfailure - 1);
                        }
                    } else if (typeof onfailure === "function") {
                        onfailure(d, url, id, callback);
                    }
                } catch { }
            }
        };
        d.setCallback(f);
        return d;
    };
    const fakeDownload = (url, id, callback, data, lastModified, owner) => {
        const d = newDownload(url, callback);
        d.owner = owner;
        d.id = id;
        d.data = data;
        d.lastModified = lastModified;
        return callback(d);
    };
    const startDownload = (url, id, callback) => {
        const d = newDownload(url, id, callback);
        if (typeof d === typeof "") {
            return d;
        }
        d.start();
        return d;
    };
    const abortAllDownloads = () => {
        for (const x in pg.misc.downloadsInProgress) {
            try {
                pg.misc.downloadsInProgress[x].aborted = true;
                pg.misc.downloadsInProgress[x].abort();
                Reflect.deleteProperty(pg.misc.downloadsInProgress, x);
            } catch { }
        }
    };
