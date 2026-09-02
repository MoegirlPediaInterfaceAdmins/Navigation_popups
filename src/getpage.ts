import type { Downloader } from "./downloader.ts";
import { fakeDownload, startDownload } from "./downloader.ts";
import type { Navpopup } from "./navpopup.ts";
import { log, pg } from "./globals.ts";
export const getPageWithCaching = (url: string, onComplete: (d: Downloader) => void, owner: Navpopup) => {
    log(`getPageWithCaching, url=${url}`);
    const i = findInPageCache(url);
    let d;
    if (i > -1) {
        const page = pg.cache.pages[i];
        fakeDownload(url, owner.idNumber, onComplete, page.data, page.lastModified, owner);
    } else {
        d = getPage(url, onComplete, owner);
        if (d && owner?.addDownload && !(typeof d === "string")) {
            owner.addDownload(d);
            d.owner = owner;
        }
    }
};
const getPage = (url: string, onComplete: (d: Downloader) => void, owner: Navpopup) => {
    log("getPage");
    const callback = (d: Downloader) => {
        if (!d.aborted) {
            addPageToCache(d);
            onComplete(d);
        }
    };
    return startDownload(url, owner.idNumber, callback);
};
const findInPageCache = (url: string) => {
    for (let i = 0; i < pg.cache.pages.length; ++i) {
        if (url === pg.cache.pages[i].url) {
            return i;
        }
    }
    return -1;
};
const addPageToCache = (download: Downloader) => {
    log(`addPageToCache ${download.url}`);
    const page = {
        url: download.url,
        data: download.data,
        lastModified: download.lastModified,
    };
    return pg.cache.pages.push(page);
};
