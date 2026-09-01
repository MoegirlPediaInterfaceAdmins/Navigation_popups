    const loadAPIPreview = (queryType, article, navpop) => {
        const art = new Title(article).urlString();
        let url = `${pg.wiki.apiwikibase}?format=json&formatversion=2&action=query&`;
        let htmlGenerator = () => {
            alert("invalid html generator");
        };
        let usernameart;
        switch (queryType) {
            case "history":
                url += `titles=${art}&prop=revisions&rvlimit=${getValueOf("popupHistoryPreviewLimit")}`;
                htmlGenerator = APIhistoryPreviewHTML;
                break;
            case "category":
                url += `list=categorymembers&cmtitle=${art}`;
                htmlGenerator = APIcategoryPreviewHTML;
                break;
            case "userinfo": {
                const username = new Title(article).userName();
                usernameart = encodeURIComponent(username);
                if (pg.re.ipUser.test(username)) {
                    url += `list=blocks&bkprop=range|restrictions&bkip=${usernameart}`;
                } else {
                    url += `list=users|usercontribs&usprop=blockinfo|groups|editcount|registration|gender&ususers=${usernameart}&meta=globaluserinfo&guiprop=groups|unattached&guiuser=${usernameart}&uclimit=1&ucprop=timestamp&ucuser=${usernameart}`;
                }
                htmlGenerator = APIuserInfoPreviewHTML;
                break;
            }
            case "contribs":
                usernameart = encodeURIComponent(new Title(article).userName());
                url += `list=usercontribs&ucuser=${usernameart}&uclimit=${getValueOf("popupContribsPreviewLimit")}`;
                htmlGenerator = APIcontribsPreviewHTML;
                break;
            case "imagepagepreview": {
                let trail = "";
                if (getValueOf("popupImageLinks")) {
                    trail = `&list=imageusage&iutitle=${art}`;
                }
                url += `titles=${art}&prop=revisions|imageinfo&rvslots=main&rvprop=content${trail}`;
                htmlGenerator = APIimagepagePreviewHTML;
                break;
            }
            case "backlinks":
                url += `list=backlinks&bltitle=${art}`;
                htmlGenerator = APIbacklinksPreviewHTML;
                break;
            case "revision":
                if (article.oldid) {
                    url += `revids=${article.oldid}`;
                } else {
                    url += `titles=${article.removeAnchor().urlString()}`;
                }
                url += "&prop=revisions|pageprops|info|images|categories&meta=wikibase&rvslots=main&rvprop=ids|timestamp|flags|comment|user|content&cllimit=max&imlimit=max";
                htmlGenerator = APIrevisionPreviewHTML;
                break;
        }
        pendingNavpopTask(navpop);
        const callback = async (d) => {
            log("callback of API functions was hit");
            if (queryType === "userinfo") {
                await fetchUserGroupNames(d.data);
                showAPIPreview(queryType, htmlGenerator(article, d, navpop), navpop.idNumber, navpop, d);
                return;
            }
            showAPIPreview(queryType, htmlGenerator(article, d, navpop), navpop.idNumber, navpop, d);
        };
        const go = () => {
            getPageWithCaching(url, callback, navpop);
            return true;
        };
        if (navpop.visible || !getValueOf("popupLazyDownloads")) {
            go();
        } else {
            navpop.addHook(go, "unhide", "before", `DOWNLOAD_${queryType}_QUERY_DATA`);
        }
    };
    const linkList = (list) => {
        list.sort((x, y) => x === y ? 0 : x < y ? -1 : 1);
        const buf = [];
        for (let i = 0; i < list.length; ++i) {
            buf.push(wikiLink({
                article: new Title(list[i]),
                text: list[i].split(" ").join("&nbsp;"),
                action: "view",
            }));
        }
        return buf.join(popupString("separator"));
    };
    const getTimeOffset = () => {
        const tz = mw.user.options.get("timecorrection");
        if (tz) {
            if (tz.indexOf("|") > -1) {
                return parseInt(tz.split("|")[1], 10);
            }
        }
        return 0;
    };
    const getTimeZone = () => {
        if (!pg.user.timeZone) {
            const tz = mw.user.options.get("timecorrection");
            pg.user.timeZone = "UTC";
            if (tz) {
                const tzComponents = tz.split("|");
                if (tzComponents.length === 3 && tzComponents[0] === "ZoneInfo") {
                    pg.user.timeZone = tzComponents[2];
                } else {
                    errlog(`Unexpected timezone information: ${tz}`);
                }
            }
        }
        return pg.user.timeZone;
    };
    const useTimeOffset = () => {
        if (typeof Intl.DateTimeFormat.prototype.formatToParts === "undefined") {
            return true;
        }
        const tz = mw.user.options.get("timecorrection");
        if (tz && tz.indexOf("ZoneInfo|") === -1) {
            return true;
        }
        return false;
    };
    const getLocales = () => {
        if (!pg.user.locales) {
            let userLanguage = document.querySelector("html").getAttribute("lang");
            if (getValueOf("popupLocale")) {
                userLanguage = getValueOf("popupLocale");
            } else if (userLanguage === "en") {
                if (getMWDateFormat() === "mdy") {
                    userLanguage = "en-US";
                } else {
                    userLanguage = "en-GB";
                }
            }
            pg.user.locales = Intl.DateTimeFormat.supportedLocalesOf([userLanguage, navigator.language]);
        }
        return pg.user.locales;
    };
    const getMWDateFormat = () => mw.user.options.get("date");
    const editPreviewTable = (article, h, reallyContribs) => {
        let html = ["<table>"];
        let day = null;
        let curart = article;
        let page = null;
        let makeFirstColumnLinks;
        if (reallyContribs) {
            makeFirstColumnLinks = (currentRevision) => {
                let result = "(";
                result += `<a href="${pg.wiki.titlebase}${new Title(currentRevision.title).urlString()}&diff=prev&oldid=${currentRevision.revid}">${popupString("diff")}</a>`;
                result += "&nbsp;|&nbsp;";
                result += `<a href="${pg.wiki.titlebase}${new Title(currentRevision.title).urlString()}&action=history">${popupString("hist")}</a>`;
                result += ")";
                return result;
            };
        } else {
            const firstRevid = h[0].revid;
            makeFirstColumnLinks = (currentRevision) => {
                let result = "(";
                result += `<a href="${pg.wiki.titlebase}${new Title(curart).urlString()}&diff=${firstRevid}&oldid=${currentRevision.revid}">${popupString("cur")}</a>`;
                result += "&nbsp;|&nbsp;";
                result += `<a href="${pg.wiki.titlebase}${new Title(curart).urlString()}&diff=prev&oldid=${currentRevision.revid}">${popupString("last")}</a>`;
                result += ")";
                return result;
            };
        }
        for (let i = 0; i < h.length; ++i) {
            if (reallyContribs) {
                page = h[i].title;
                curart = new Title(page);
            }
            const minor = h[i].minor ? "<b>小 </b>" : "";
            const editDate = new Date(h[i].timestamp);
            let thisDay = formattedDate(editDate);
            const thisTime = formattedTime(editDate);
            if (thisDay === day) {
                thisDay = "";
            } else {
                day = thisDay;
            }
            if (thisDay) {
                html.push(`<tr><td colspan=3><span class="popup_history_date">${thisDay}</span></td></tr>`);
            }
            html.push(`<tr class="popup_history_row_${i % 2 ? "odd" : "even"}">`);
            html.push(`<td>${makeFirstColumnLinks(h[i])}</td>`);
            html.push(`<td><a href="${pg.wiki.titlebase}${new Title(curart).urlString()}&oldid=${h[i].revid}">${thisTime}</a></td>`);
            let col3url,
                col3txt;
            if (!reallyContribs) {
                const user = h[i].user;
                if (!h[i].userhidden) {
                    if (pg.re.ipUser.test(user)) {
                        col3url = `${pg.wiki.titlebase + mw.config.get("wgFormattedNamespaces")[pg.nsSpecialId]}:Contributions&target=${new Title(user).urlString()}`;
                    } else {
                        col3url = `${pg.wiki.titlebase + mw.config.get("wgFormattedNamespaces")[pg.nsUserId]}:${new Title(user).urlString()}`;
                    }
                    col3txt = pg.escapeQuotesHTML(user);
                } else {
                    col3url = getValueOf("popupRevDelUrl");
                    col3txt = pg.escapeQuotesHTML(popupString("revdel"));
                }
            } else {
                col3url = pg.wiki.titlebase + curart.urlString();
                col3txt = pg.escapeQuotesHTML(page);
            }
            html.push(`<td>${reallyContribs ? minor : ""}<a href="${col3url}">${col3txt}</a></td>`);
            let comment = "";
            const c = h[i].comment || (typeof h[i].slots !== "undefined" ? h[i].slots.main.content : null);
            if (c) {
                comment = new Previewmaker(c, new Title(curart).toUrl()).editSummaryPreview();
            } else if (h[i].commenthidden) {
                comment = popupString("revdel");
            }
            html.push(`<td>${!reallyContribs ? minor : ""}${comment}</td>`);
            html.push("</tr>");
            html = [html.join("")];
        }
        html.push("</table>");
        return html.join("");
    };
    const adjustDate = (d, offset) => {
        const o = offset * 60 * 1e3;
        return new Date(+d + o);
    };
    const convertTimeZone = (date, timeZone) => new Date(date.toLocaleString("en-US", {
        timeZone: timeZone,
    }));
    const formattedDateTime = (date) => {
        if (useTimeOffset()) {
            return `${formattedDate(date)} ${formattedTime(date)}`;
        }
        if (getMWDateFormat() === "ISO 8601") {
            const d2 = convertTimeZone(date, getTimeZone());
            return `${map(zeroFill, [d2.getFullYear(), d2.getMonth() + 1, d2.getDate()]).join("-")}T${map(zeroFill, [d2.getHours(), d2.getMinutes(), d2.getSeconds()]).join(":")}`;
        }
        const options = getValueOf("popupDateTimeFormatterOptions");
        options.timeZone = getTimeZone();
        return date.toLocaleString(getLocales(), options);
    };
    const formattedDate = (date) => {
        if (useTimeOffset()) {
            const d2 = adjustDate(date, getTimeOffset());
            return map(zeroFill, [d2.getUTCFullYear(), d2.getUTCMonth() + 1, d2.getUTCDate()]).join("-");
        }
        if (getMWDateFormat() === "ISO 8601") {
            const d2 = convertTimeZone(date, getTimeZone());
            return map(zeroFill, [d2.getFullYear(), d2.getMonth() + 1, d2.getDate()]).join("-");
        }
        const options = getValueOf("popupDateFormatterOptions");
        options.timeZone = getTimeZone();
        return date.toLocaleDateString(getLocales(), options);
    };
    const formattedTime = (date) => {
        if (useTimeOffset()) {
            const d2 = adjustDate(date, getTimeOffset());
            return map(zeroFill, [d2.getUTCHours(), d2.getUTCMinutes(), d2.getUTCSeconds()]).join(":");
        }
        if (getMWDateFormat() === "ISO 8601") {
            const d2 = convertTimeZone(date, getTimeZone());
            return map(zeroFill, [d2.getHours(), d2.getMinutes(), d2.getSeconds()]).join(":");
        }
        const options = getValueOf("popupTimeFormatterOptions");
        options.timeZone = getTimeZone();
        return date.toLocaleTimeString(getLocales(), options);
    };
    const fetchUserGroupNames = (userinfoResponse) => {
        const queryObj = getJsObj(userinfoResponse).query;
        const user = anyChild(queryObj.users);
        const messages = [];
        if (user.groups) {
            user.groups.forEach((groupName) => {
                messages.push(`group-${groupName}-member`);
            });
        }
        if (queryObj.globaluserinfo && queryObj.globaluserinfo.groups) {
            queryObj.globaluserinfo.groups.forEach((groupName) => {
                messages.push(`group-${groupName}-member`);
            });
        }
        return getMwApi().loadMessagesIfMissing(messages);
    };
    const showAPIPreview = (queryType, html, id, navpop, download) => {
        let target = "popupPreview";
        completedNavpopTask(navpop);
        switch (queryType) {
            case "imagelinks":
            case "category":
                target = "popupPostPreview";
                break;
            case "userinfo":
                target = "popupUserData";
                break;
            case "revision":
                insertPreview(download);
                return;
        }
        setPopupTipsAndHTML(html, target, id);
    };
    const APIrevisionPreviewHTML = (article, download) => {
        try {
            const jsObj = getJsObj(download.data);
            const page = anyChild(jsObj.query.pages);
            if (page.missing) {
                download.owner = null;
                return;
            }
            const content = page?.revisions?.[0]?.slots?.main?.contentmodel === "wikitext" ? page.revisions[0].slots.main.content : null;
            if (typeof content === "string") {
                download.data = content;
                download.lastModified = new Date(page.revisions[0].timestamp);
            }
            if (page.pageprops.wikibase_item) {
                download.wikibaseItem = page.pageprops.wikibase_item;
                download.wikibaseRepo = `${jsObj.query.wikibase.repo.url.base}${jsObj.query.wikibase.repo.url.articlepath}`;
            }
        } catch (someError) {
            return "Revision preview failed :(";
        }
    };
    const APIbacklinksPreviewHTML = (article, download) => {
        try {
            const jsObj = getJsObj(download.data);
            const list = jsObj.query.backlinks;
            let html = [];
            if (!list) {
                return popupString("No backlinks found");
            }
            for (let i = 0; i < list.length; i++) {
                const t = new Title(list[i].title);
                html.push(`<a href="${pg.wiki.titlebase}${t.urlString()}">${t.toString().entify()}</a>`);
            }
            html = html.join(popupString("separator"));
            if (jsObj.continue && jsObj.continue.blcontinue) {
                html += popupString(" and more");
            }
            return html;
        } catch (someError) {
            return "backlinksPreviewHTML went wonky";
        }
    };
    pg.fn.APIsharedImagePagePreviewHTML = (obj) => {
        log("APIsharedImagePagePreviewHTML");
        const popupid = obj.requestid;
        if (obj.query && obj.query.pages) {
            const page = anyChild(obj.query.pages);
            const content = page?.revisions?.[0]?.slots?.main?.contentmodel === "wikitext" ? page.revisions[0].slots.main.content : null;
            if (typeof content === "string" && pg && pg.current && pg.current.link && pg.current.link.navpopup) {
                const p = new Previewmaker(content, pg.current.link.navpopup.article, pg.current.link.navpopup);
                p.makePreview();
                setPopupHTML(p.html, "popupSecondPreview", popupid);
            }
        }
    };
    const APIimagepagePreviewHTML = (article, download, navpop) => {
        try {
            const jsObj = getJsObj(download.data);
            const page = anyChild(jsObj.query.pages);
            const content = page?.revisions?.[0]?.slots?.main?.contentmodel === "wikitext" ? page.revisions[0].slots.main.content : null;
            let ret = "";
            let alt = "";
            try {
                alt = navpop.parentAnchor.childNodes[0].alt;
            } catch { }
            if (alt) {
                ret = `${ret}<hr /><b>${popupString("Alt text:")}</b> ${pg.escapeQuotesHTML(alt)}`;
            }
            if (typeof content === "string") {
                const p = prepPreviewmaker(content, article, navpop);
                p.makePreview();
                if (p.html) {
                    ret += `<hr />${p.html}`;
                }
                if (getValueOf("popupSummaryData")) {
                    const info = getPageInfo(content, download);
                    log(info);
                    setPopupTrailer(info, navpop.idNumber);
                }
            }
            if (page && page.imagerepository === "shared") {
                const art = new Title(article);
                const encart = encodeURIComponent(`File:${art.stripNamespace()}`);
                const shared_url = `${pg.wiki.apicommonsbase}?format=json&formatversion=2&callback=pg.fn.APIsharedImagePagePreviewHTML&requestid=${navpop.idNumber}&action=query&prop=revisions&rvslots=main&rvprop=content&titles=${encart}`;
                ret = `${ret}<hr />${popupString("Image from Commons")}: <a href="${pg.wiki.commonsbase}?title=${encart}">${popupString("Description page")}</a>`;
                mw.loader.load(shared_url);
            }
            showAPIPreview("imagelinks", APIimagelinksPreviewHTML(article, download), navpop.idNumber, download);
            return ret;
        } catch (someError) {
            return "API imagepage preview failed :(";
        }
    };
    const APIimagelinksPreviewHTML = (article, download) => {
        try {
            const jsobj = getJsObj(download.data);
            const list = jsobj.query.imageusage;
            if (list) {
                const ret = [];
                for (let i = 0; i < list.length; i++) {
                    ret.push(list[i].title);
                }
                if (ret.length === 0) {
                    return popupString("No image links found");
                }
                return `<h2>${popupString("File links")}</h2>${linkList(ret)}`;
            }
            return popupString("No image links found");
        } catch (someError) {
            return "Image links preview generation failed :(";
        }
    };
    const APIcategoryPreviewHTML = (article, download) => {
        try {
            const jsobj = getJsObj(download.data);
            const list = jsobj.query.categorymembers;
            let ret = [];
            for (let p = 0; p < list.length; p++) {
                ret.push(list[p].title);
            }
            if (ret.length === 0) {
                return popupString("Empty category");
            }
            ret = `<h2>${tprintf("Category members (%s shown)", [ret.length])}</h2>${linkList(ret)}`;
            if (jsobj.continue && jsobj.continue.cmcontinue) {
                ret += popupString(" and more");
            }
            return ret;
        } catch (someError) {
            return "Category preview failed :(";
        }
    };
    const APIuserInfoPreviewHTML = (article, download) => {
        let ret = [];
        let queryobj;
        try {
            queryobj = getJsObj(download.data).query;
        } catch (someError) {
            return "Userinfo preview failed :(";
        }
        const user = anyChild(queryobj.users);
        if (user) {
            const globaluserinfo = queryobj.globaluserinfo;
            if (user.invalid === "") {
                ret.push(popupString("Invalid user"));
            } else if (user.missing === "") {
                ret.push(popupString("Not a registered username"));
            }
            if (user.blockedby) {
                if (user.blockpartial) {
                    ret.push(`<b>${popupString("Has blocks")}</b>`);
                } else {
                    ret.push(`<b>${popupString("BLOCKED")}</b>`);
                }
            }
            if (globaluserinfo && (Reflect.has(globaluserinfo, "locked") || Reflect.has(globaluserinfo, "hidden"))) {
                let lockedSulAccountIsAttachedToThis = true;
                for (let i = 0; globaluserinfo.unattached && i < globaluserinfo.unattached.length; i++) {
                    if (globaluserinfo.unattached[i].wiki === mw.config.get("wgDBname")) {
                        lockedSulAccountIsAttachedToThis = false;
                        break;
                    }
                }
                if (lockedSulAccountIsAttachedToThis) {
                    if (Reflect.has(globaluserinfo, "locked")) {
                        ret.push(`<b><i>${popupString("LOCKED")}</i></b>`);
                    }
                    if (Reflect.has(globaluserinfo, "hidden")) {
                        ret.push(`<b><i>${popupString("HIDDEN")}</i></b>`);
                    }
                }
            }
            if (getValueOf("popupShowGender") && user.gender) {
                switch (user.gender) {
                    case "male":
                        ret.push(popupString("♂"));
                        break;
                    case "female":
                        ret.push(popupString("♀"));
                        break;
                }
            }
            if (user.groups) {
                // 自定义
                const ug = [];
                user.groups.forEach((groupName) => {
                    if (["*", "user", "autoconfirmed"].indexOf(groupName) === -1) {
                        ug.push(pg.escapeQuotesHTML(mw.message(`group-${groupName}-member`, user.gender).text()));
                    }
                });
                if (user.groups.indexOf("autoconfirmed") === -1) {
                    ug.push(`<b>${pg.escapeQuotesHTML(popupString("group-no-autoconfirmed"))}</b>`);
                }
                if (ug.length === 0) {
                    ug.push(pg.escapeQuotesHTML(mw.message("group-user-member", user.gender).text()));
                }
                ret.push(ug.join(popupString("separator")));
            }
            if (globaluserinfo && globaluserinfo.groups) {
                const gug = [];
                globaluserinfo.groups.forEach((groupName) => {
                    gug.push(`<i>${pg.escapeQuotesHTML(mw.message(`group-${groupName}-member`, user.gender).text())}</i>`);
                });
                ret.push(gug.join(popupString("separator")));
            }
            if (user.registration) {
                ret.push(pg.escapeQuotesHTML((user.editcount ? user.editcount : "0") + popupString(" edits since: ") + (user.registration ? formattedDate(new Date(user.registration)) : "")));
            }
        }
        if (queryobj.usercontribs && queryobj.usercontribs.length) {
            ret.push(popupString("last edit on ") + formattedDate(new Date(queryobj.usercontribs[0].timestamp)));
        }
        if (queryobj.blocks) {
            ret.push(popupString("IP user"));
            for (let l = 0; l < queryobj.blocks.length; l++) {
                let rbstr = queryobj.blocks[l].rangestart === queryobj.blocks[l].rangeend ? "BLOCK" : "RANGEBLOCK";
                rbstr = !Array.isArray(queryobj.blocks[l].restrictions) ? `Has ${rbstr.toLowerCase()}s` : `${rbstr}ED`;
                ret.push(`<b>${popupString(rbstr)}</b>`);
            }
        }
        ret = `<hr />${ret.join(popupString("comma"))}`;
        return ret;
    };
    const APIcontribsPreviewHTML = (article, download, navpop) => APIhistoryPreviewHTML(article, download, navpop, true);
    const APIhistoryPreviewHTML = (article, download, navpop, reallyContribs) => {
        try {
            const jsobj = getJsObj(download.data);
            let edits = [];
            if (reallyContribs) {
                edits = jsobj.query.usercontribs;
            } else {
                edits = anyChild(jsobj.query.pages).revisions;
            }
            const ret = editPreviewTable(article, edits, reallyContribs);
            return ret;
        } catch (someError) {
            return popupString("History preview failed");
        }
    };
