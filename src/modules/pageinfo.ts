import type { Moment } from "moment";
import { pg } from "../globals.ts";
import { getValueOf } from "./options.ts";
import { popupString, tprintf } from "./strings.ts";
import type { Downloader } from "./downloader.ts";
import { isDisambig, stubCount } from "./titles.ts";
import type { Title } from "./titles.ts";
import { upcaseFirst } from "./tools.ts";
type PopupFilterFn = (data: string, download: Downloader, article?: Title) => string | false | undefined;
export const popupFilterPageSize = (data: string) => formatBytes(data.length);
export const popupFilterCountLinks = (data: string) => {
    const num = countLinks(data);
    return `${num}&nbsp;${num !== 1 ? popupString("wikiLinks") : popupString("wikiLink")}`;
};
export const popupFilterCountImages = (data: string) => {
    const num = countImages(data);
    return `${num}&nbsp;${num !== 1 ? popupString("images") : popupString("image")}`;
};
export const popupFilterCountCategories = (data: string) => {
    const num = countCategories(data);
    return `${num}&nbsp;${num !== 1 ? popupString("categories") : popupString("category")}`;
};
export const popupFilterLastModified = (data: string, download: Downloader) => {
    const lastmod = download.lastModified;
    const age = moment(lastmod); // formatAge 现仅直接接受 moment 对象
    if (lastmod && getValueOf("popupLastModified")) {
        return tprintf("%s old", [formatAge(age)]).replace(/ /g, "&nbsp;");
    }
    return "";
};
export const popupFilterWikibaseItem = (data: string, download: Downloader) => {
    if (!download.wikibaseItem || !download.wikibaseRepo) {
        return "";
    }
    return tprintf('<a href="%s">%s</a>', [
        download.wikibaseRepo.replace(/\$1/g, download.wikibaseItem),
        download.wikibaseItem,
    ]);
};
const formatAge = (age: Moment) => {
    const now = moment();
    const isBefore = age.isBefore(now);
    const monthsHave31Days = [0, 2, 4, 6, 7, 9, 11]; // 月份从0开始
    let year = isBefore ? now.year() - age.year() : age.year() - now.year(),
        month = isBefore ? now.month() - age.month() : age.month() - now.month(),
        day = isBefore ? now.date() - age.date() : age.date() - now.date(),
        hour = isBefore ? now.hour() - age.hour() : age.hour() - now.hour(),
        minute = isBefore ? now.minute() - age.minute() : age.minute() - now.minute(),
        second = isBefore ? now.second() - age.second() : age.second() - now.second();
    if (second < 0) {
        minute--;
        second += 60;
    }
    if (minute < 0) {
        hour--;
        minute += 60;
    }
    if (hour < 0) {
        day--;
        hour += 24;
    }
    if (day < 0) {
        month--;
        if (monthsHave31Days.includes((isBefore ? age : now).month())) {
            day += 31;
        } else if ((isBefore ? age : now).month() === 1) {
            if ((isBefore ? age : now).year() % 4 === 0) {
                day += 29;
            } else {
                day += 28;
            }
        } else {
            day += 30;
        }
    }
    if (month < 0) {
        year--;
        month += 12;
    }
    let result = "";
    if (year > 0) {
        result += addunit(year, "year");
    }
    if (month > 0) {
        result += addunit(month, "month");
    } else if (result !== "") {
        result += addunit(0, "month");
    }
    if (day > 0) {
        result += addunit(day, "day");
    } else if (result !== "") {
        result += addunit(0, "day");
    }
    if (hour > 0) {
        result += addunit(hour, "hour");
    } else if (result !== "") {
        result += addunit(0, "hour");
    }
    if (minute > 0) {
        result += addunit(minute, "minute");
    } else if (result !== "") {
        result += addunit(0, "minute");
    }
    if (second > 0) {
        result += addunit(second, "second");
    } else if (result !== "") {
        result += addunit(0, "second");
    }
    return result.replace(/(\d) /g, "$1");
};
const addunit = (num: number, str: string) => `${num} ${num !== 1 ? popupString(`${str}s`) : popupString(str)}`;
const runPopupFilters = (list: PopupFilterFn[], data: string, download: Downloader) => {
    const ret: string[] = [];
    for (const filter of list) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- popupFilters is user config; may hold non-functions
        if (filter && typeof filter === "function") {
            const s = filter(data, download, download.owner?.article);
            if (s) {
                ret.push(s);
            }
        }
    }
    return ret;
};
export const getPageInfo = (data: string, download: Downloader) => {
    if (!data || data.length === 0) {
        return popupString("Empty page");
    }
    const popupFilters = (getValueOf("popupFilters") ?? []) as PopupFilterFn[];
    const extraPopupFilters = (getValueOf("extraPopupFilters") ?? []) as PopupFilterFn[];
    const pageInfoArray = runPopupFilters(popupFilters.concat(extraPopupFilters), data, download);
    let pageInfo = pageInfoArray.join(popupString("comma"));
    if (pageInfo !== "") {
        pageInfo = upcaseFirst(pageInfo);
    }
    return pageInfo;
};
const countLinks = (wikiText: string) => wikiText.split("[[").length - 1;
const countImages = (wikiText: string) => (wikiText.parenSplit(pg.re.image as RegExp).length - 1) / (Number(pg.re.imageBracketCount) + 1);
const countCategories = (wikiText: string) => (wikiText.parenSplit(pg.re.category as RegExp).length - 1) / (Number(pg.re.categoryBracketCount) + 1);
export const popupFilterStubDetect = (data: string, download: Downloader, article: Title) => {
    const counts = stubCount(data, article);
    if (counts && counts.real) {
        return popupString("stub");
    }
    if (counts && counts.sect) {
        return popupString("section stub");
    }
    return "";
};
export const popupFilterDisambigDetect = (data: string, download: Downloader, article: Title) => {
    if (!getValueOf("popupAllDabsStubs") && article.namespace()) {
        return "";
    }
    return isDisambig(data, article) ? popupString("disambig") : "";
};
const formatBytes = (num: number) => num > 949 ? `${Math.round(num / 100) / 10}${popupString("kB")}` : `${num}&nbsp;${popupString("bytes")}`;
