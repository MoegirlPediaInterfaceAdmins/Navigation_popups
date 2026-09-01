    const getPageWithCaching = (url, onComplete, owner) => {
        log(`getPageWithCaching, url=${url}`);
        const i = findInPageCache(url);
        let d;
        if (i > -1) {
            fakeDownload(url, owner.idNumber, onComplete, pg.cache.pages[i].data, pg.cache.pages[i].lastModified, owner);
        } else {
            d = getPage(url, onComplete, owner);
            if (d && owner && owner.addDownload) {
                owner.addDownload(d);
                d.owner = owner;
            }
        }
    };
    const getPage = (url, onComplete, owner) => {
        log("getPage");
        const callback = (d) => {
            if (!d.aborted) {
                addPageToCache(d);
                onComplete(d);
            }
        };
        return startDownload(url, owner.idNumber, callback);
    };
    const findInPageCache = (url) => {
        for (let i = 0; i < pg.cache.pages.length; ++i) {
            if (url === pg.cache.pages[i].url) {
                return i;
            }
        }
        return -1;
    };
    const addPageToCache = (download) => {
        log(`addPageToCache ${download.url}`);
        const page = {
            url: download.url,
            data: download.data,
            lastModified: download.lastModified,
        };
        return pg.cache.pages.push(page);
    };
