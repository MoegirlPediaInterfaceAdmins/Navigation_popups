// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { pendingNavpopTask } from "./actions.ts";
import { getPageWithCaching } from "./getpage.ts";
import { log, pg } from "./globals.ts";
import { popTipsSoonFn } from "./htmloutput.ts";
import { getValueOf } from "./options.ts";
import { popupString } from "./strings.ts";
import { isValidImageName } from "./titles.ts";
import { anyChild, getJsObj, upcaseFirst } from "./tools.ts";
    export const loadImage = (image, navpop) => {
        if (typeof image.stripNamespace !== "function") {
            alert("loadImages bad");
        }
        if (!getValueOf("popupImages")) {
            return;
        }
        if (!isValidImageName(image)) {
            return false;
        }
        const art = image.urlString();
        let url = `${pg.wiki.apiwikibase}?format=json&formatversion=2&action=query`;
        url += `&prop=imageinfo&iiprop=url|mime&iiurlwidth=${getValueOf("popupImageSizeLarge")}`;
        url += `&titles=${art}`;
        pendingNavpopTask(navpop);
        const callback = (d) => {
            popupsInsertImage(navpop.idNumber, navpop, d);
        };
        const go = () => {
            getPageWithCaching(url, callback, navpop);
            return true;
        };
        if (navpop.visible || !getValueOf("popupLazyDownloads")) {
            go();
        } else {
            navpop.addHook(go, "unhide", "after", "DOWNLOAD_IMAGE_QUERY_DATA");
        }
    };
    const popupsInsertImage = (id, navpop, download) => {
        log("popupsInsertImage");
        let imageinfo;
        try {
            const jsObj = getJsObj(download.data);
            const imagepage = anyChild(jsObj.query.pages);
            if (typeof imagepage.imageinfo === "undefined") {
                return;
            }
            imageinfo = imagepage.imageinfo[0];
        } catch (someError) {
            log("popupsInsertImage failed :(");
            return;
        }
        const popupImage = document.getElementById(`popupImg${id}`);
        if (!popupImage) {
            log("could not find insertion point for image");
            return;
        }
        popupImage.width = getValueOf("popupImageSize");
        popupImage.style.display = "inline";
        if (imageinfo.thumburl) {
            popupImage.src = imageinfo.thumburl;
        } else if (imageinfo.mime.indexOf("image") === 0) {
            popupImage.src = imageinfo.url;
            log("a thumb could not be found, using original image");
        } else {
            log("fullsize imagethumb, but not sure if it's an image");
        }
        const a = document.getElementById(`popupImageLink${id}`);
        if (a === null) {
            return null;
        }
        switch (getValueOf("popupThumbAction")) {
            case "imagepage": {
                if (pg.current.article.namespaceId() !== pg.nsImageId) {
                    a.href = imageinfo.descriptionurl;
                    popTipsSoonFn(`popupImage${id}`)();
                    break;
                }
                // falls through
            }
            case "sizetoggle":
                a.onclick = toggleSize;
                a.title = popupString("Toggle image size");
                return;
            case "linkfull":
                a.href = imageinfo.url;
                a.title = popupString("Open full-size image");
                return;
        }
    };
    function toggleSize() {
        const imgContainer = this;
        if (!imgContainer) {
            alert("imgContainer is null :/");
            return;
        }
        const img = imgContainer.firstChild;
        if (!img) {
            alert("img is null :/");
            return;
        }
        if (!img.style.width || img.style.width === "") {
            img.style.width = "100%";
        } else {
            img.style.width = "";
        }
    }
    export const getValidImageFromWikiText = (wikiText) => {
        let matched = null;
        const t = removeMatchesUnless(wikiText, /(<!--[\s\S]*?-->)/, 1, /^<!--[^[]*popup/i);
        let match = pg.re.image.exec(t);
        while (match) {
            const m = match[2] || match[6];
            if (isValidImageName(m)) {
                matched = m;
                break;
            }
            match = pg.re.image.exec(t);
        }
        pg.re.image.lastIndex = 0;
        if (!matched) {
            return null;
        }
        return `${mw.config.get("wgFormattedNamespaces")[pg.nsImageId]}:${upcaseFirst(matched)}`;
    };
    const removeMatchesUnless = (str, re1, parencount, re2) => {
        const split = str.parenSplit(re1);
        const c = parencount + 1;
        for (let i = 0; i < split.length; ++i) {
            if (i % c === 0 || re2.test(split[i])) {
                continue;
            }
            split[i] = "";
        }
        return split.join("");
    };
