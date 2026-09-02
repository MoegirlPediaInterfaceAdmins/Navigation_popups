import { pg } from "./globals.ts";
import { getValueOf } from "./options.ts";
import { popupString, tprintf } from "./strings.ts";
import { isDisambig, stubCount } from "./titles.ts";
import { upcaseFirst } from "./tools.ts";
    export const popupFilterPageSize = (data) => formatBytes(data.length);
    export const popupFilterCountLinks = (data) => {
        const num = countLinks(data);
        return `${num}&nbsp;${num !== 1 ? popupString("wikiLinks") : popupString("wikiLink")}`;
    };
    export const popupFilterCountImages = (data) => {
        const num = countImages(data);
        return `${num}&nbsp;${num !== 1 ? popupString("images") : popupString("image")}`;
    };
    export const popupFilterCountCategories = (data) => {
        const num = countCategories(data);
        return `${num}&nbsp;${num !== 1 ? popupString("categories") : popupString("category")}`;
    };
    export const popupFilterLastModified = (data, download) => {
        const lastmod = download.lastModified;
        const age = moment(lastmod); // formatAge 现仅直接接受 moment 对象
        if (lastmod && getValueOf("popupLastModified")) {
            return tprintf("%s old", [formatAge(age)]).replace(/ /g, "&nbsp;");
        }
        return "";
    };
    export const popupFilterWikibaseItem = (data, download) => {
        if (!download.wikibaseItem || !download.wikibaseRepo) {
            return "";
        }
        return tprintf('<a href="%s">%s</a>', [
            download.wikibaseRepo.replace(/\$1/g, download.wikibaseItem),
            download.wikibaseItem,
        ]);
    };
    const formatAge = (age) => {
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
    const addunit = (num, str) => `${num} ${num !== 1 ? popupString(`${str}s`) : popupString(str)}`;
    const runPopupFilters = (list, data, download) => {
        const ret = [];
        for (let i = 0; i < list.length; ++i) {
            if (list[i] && typeof list[i] === "function") {
                const s = list[i](data, download, download.owner.article);
                if (s) {
                    ret.push(s);
                }
            }
        }
        return ret;
    };
    export const getPageInfo = (data, download) => {
        if (!data || data.length === 0) {
            return popupString("Empty page");
        }
        const popupFilters = getValueOf("popupFilters") || [];
        const extraPopupFilters = getValueOf("extraPopupFilters") || [];
        const pageInfoArray = runPopupFilters(popupFilters.concat(extraPopupFilters), data, download);
        let pageInfo = pageInfoArray.join(popupString("comma"));
        if (pageInfo !== "") {
            pageInfo = upcaseFirst(pageInfo);
        }
        return pageInfo;
    };
    const countLinks = (wikiText) => wikiText.split("[[").length - 1;
    const countImages = (wikiText) => (wikiText.parenSplit(pg.re.image).length - 1) / (pg.re.imageBracketCount + 1);
    const countCategories = (wikiText) => (wikiText.parenSplit(pg.re.category).length - 1) / (pg.re.categoryBracketCount + 1);
    export const popupFilterStubDetect = (data, download, article) => {
        const counts = stubCount(data, article);
        if (counts.real) {
            return popupString("stub");
        }
        if (counts.sect) {
            return popupString("section stub");
        }
        return "";
    };
    export const popupFilterDisambigDetect = (data, download, article) => {
        if (!getValueOf("popupAllDabsStubs") && article.namespace()) {
            return "";
        }
        return isDisambig(data, article) ? popupString("disambig") : "";
    };
    const formatBytes = (num) => num > 949 ? Math.round(num / 100) / 10 + popupString("kB") : `${num}&nbsp;${popupString("bytes")}`;
