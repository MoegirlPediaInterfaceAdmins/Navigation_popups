import { pendingNavpopTask } from "./actions.ts";
import type { Downloader } from "./downloader.ts";
import type { Navpopup } from "./navpopup.ts";
import type { Title } from "./titles.ts";
import { getPageWithCaching } from "./getpage.ts";
import { log, pg } from "./globals.ts";
import { popTipsSoonFn } from "./htmloutput.ts";
import { getValueOf } from "./options.ts";
import { popupString } from "./strings.ts";
import { isValidImageName } from "./titles.ts";
import { anyChild, getJsObj, upcaseFirst } from "./tools.ts";
export const loadImage = (image: Title, navpop: Navpopup) => {
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
    url += `&prop=imageinfo&iiprop=url|mime&iiurlwidth=${getValueOf("popupImageSizeLarge") as string}`;
    url += `&titles=${art}`;
    pendingNavpopTask(navpop);
    const callback = (d: Downloader) => {
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
const popupsInsertImage = (id: number | undefined, navpop: Navpopup, download: Downloader) => {
    log("popupsInsertImage");
    let imageinfo: { thumburl?: string; url: string; mime: string; descriptionurl: string };
    try {
        interface ImageQuery {
            query: { pages: Record<string, { imageinfo?: { thumburl?: string; url: string; mime: string; descriptionurl: string }[] }> };
        }
        const jsObj = getJsObj(download.data ?? "") as ImageQuery;
        const imagepage = anyChild(jsObj.query.pages) as NonNullable<ReturnType<typeof anyChild<{ imageinfo?: { thumburl?: string; url: string; mime: string; descriptionurl: string }[] }>>>;
        if (typeof imagepage.imageinfo === "undefined") {
            return;
        }
        imageinfo = imagepage.imageinfo[0];
    } catch {
        log("popupsInsertImage failed :(");
        return;
    }
    const popupImage = document.getElementById(`popupImg${String(id)}`) as HTMLImageElement | null;
    if (!popupImage) {
        log("could not find insertion point for image");
        return;
    }
    popupImage.width = Number(getValueOf("popupImageSize"));
    popupImage.style.display = "inline";
    if (imageinfo.thumburl) {
        popupImage.src = imageinfo.thumburl;
    } else if (imageinfo.mime.startsWith("image")) {
        popupImage.src = imageinfo.url;
        log("a thumb could not be found, using original image");
    } else {
        log("fullsize imagethumb, but not sure if it's an image");
    }
    const a = document.getElementById(`popupImageLink${String(id)}`) as HTMLAnchorElement | null;
    if (a === null) {
        return null;
    }
    switch (getValueOf("popupThumbAction")) {
        case "imagepage": {
            if (pg.current.article && pg.current.article.namespaceId() !== pg.nsImageId) {
                a.href = imageinfo.descriptionurl;
                popTipsSoonFn(`popupImage${String(id)}`)();
                break;
            }
            a.onclick = toggleSize;
            a.title = popupString("Toggle image size");
            return;
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
function toggleSize(this: GlobalEventHandlers) {
    const imgContainer = this as HTMLElement;
    if (!imgContainer) {
        alert("imgContainer is null :/");
        return;
    }
    const img = imgContainer.firstChild as HTMLElement | null;
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
export const getValidImageFromWikiText = (wikiText: string) => {
    let matched = null;
    const t = removeMatchesUnless(wikiText, /(<!--[\s\S]*?-->)/, 1, /^<!--[^[]*popup/i);
    let match = (pg.re.image as RegExp).exec(t);
    while (match) {
        const m = match[2] || match[6];
        if (isValidImageName(m)) {
            matched = m;
            break;
        }
        match = (pg.re.image as RegExp).exec(t);
    }
    (pg.re.image as RegExp).lastIndex = 0;
    if (!matched) {
        return null;
    }
    return `${mw.config.get("wgFormattedNamespaces")[pg.nsImageId ?? 6]}:${upcaseFirst(matched)}`;
};
const removeMatchesUnless = (str: string, re1: RegExp, parencount: number, re2: RegExp) => {
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
