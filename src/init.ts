import { setupTooltips } from "./actions.ts";
import type { SpecialPageAlias } from "./types/pg.ts";
import { setupDebugging } from "./debug.ts";
import { log, pg } from "./globals.ts";
import { setupLivePreview } from "./livepreview.ts";
import { nsRe, nsReImage, setInterwiki, setNamespaces, setRedirs } from "./namespaces.ts";
import { Navpopup } from "./navpopup.ts";
import { getValueOf, setOptions } from "./options.ts";
import { literalizeRegex, map } from "./tools.ts";
const setSiteInfo = () => {
    if (window.popupLocalDebug) {
        pg.wiki.hostname = "en.wikipedia.org";
    } else {
        pg.wiki.hostname = location.hostname;
    }
    pg.wiki.wikimedia = /(wiki([pm]edia|source|books|news|quote|versity|species|voyage|data)|metawiki|wiktionary|mediawiki)[.]org/.test(pg.wiki.hostname);
    pg.wiki.wikia = /[.]wikia[.]com$/i.test(pg.wiki.hostname);
    pg.wiki.isLocal = pg.wiki.hostname.startsWith("localhost");
    pg.wiki.commons = pg.wiki.wikimedia && pg.wiki.hostname !== "commons.wikimedia.org" ? "commons.wikimedia.org" : null;
    pg.wiki.lang = mw.config.get("wgContentLanguage");
    const port = location.port ? `:${location.port}` : "";
    pg.wiki.sitebase = pg.wiki.hostname + port;
};
const setUserInfo = async () => {
    const params = {
        action: "query",
        list: "users",
        ususers: mw.config.get("wgUserName") ?? "",
        usprop: "rights",
    };
    pg.user.canReview = false;
    if (getValueOf("popupReview")) {
        const data = await getMwApi().get(params);
        const rights = data.query.users[0].rights;
        pg.user.canReview = rights.indexOf("review") !== -1;
    }
};
const fetchSpecialPageNames = async () => {
    const params = {
        action: "query",
        meta: "siteinfo",
        siprop: "specialpagealiases",
        formatversion: 2,
        uselang: "content",
        maxage: 3600,
    };
    const data = await getMwApi().get(params);
    pg.wiki.specialpagealiases = data.query.specialpagealiases;
};
const setTitleBase = () => {
    const protocol = window.popupLocalDebug ? "http:" : location.protocol;
    pg.wiki.articlePath = mw.config.get("wgArticlePath").replace(/\/\$1/, "");
    pg.wiki.botInterfacePath = mw.config.get("wgScript");
    pg.wiki.APIPath = `${mw.config.get("wgScriptPath")}/api.php`;
    const titletail = `${pg.wiki.botInterfacePath}?title=`;
    pg.wiki.titlebase = `${protocol}//${pg.wiki.sitebase}${titletail}`;
    pg.wiki.wikibase = `${protocol}//${pg.wiki.sitebase}${pg.wiki.botInterfacePath}`;
    pg.wiki.apiwikibase = `${protocol}//${pg.wiki.sitebase}${pg.wiki.APIPath}`;
    pg.wiki.articlebase = `${protocol}//${pg.wiki.sitebase}${pg.wiki.articlePath}`;
    pg.wiki.commonsbase = `${protocol}//${pg.wiki.commons}${pg.wiki.botInterfacePath}`;
    pg.wiki.apicommonsbase = `${protocol}//${pg.wiki.commons}${pg.wiki.APIPath}`;
    pg.re.basenames = RegExp(`^(${map(literalizeRegex, [pg.wiki.titlebase, pg.wiki.articlebase]).join("|")})`);
};
const setMainRegex = () => {
    const reStart = "[^:]*://";
    let preTitles = `(?:${literalizeRegex(String(mw.config.get("wgScript")))}|${literalizeRegex(String(mw.config.get("wgScriptPath")))}/(?:index[.]php|wiki[.]phtml))`;
    preTitles += `[?]title=|${literalizeRegex(`${pg.wiki.articlePath}/`)}`;
    const reEnd = `(${preTitles})([^&?#]*)[^#]*(?:#(.+))?`;
    pg.re.main = RegExp(reStart + literalizeRegex(pg.wiki.sitebase) + reEnd);
};
const buildSpecialPageGroup = (specialPageObj: { realname: string; aliases: string[] }) => {
    const variants = [];
    variants.push(mw.util.escapeRegExp(specialPageObj.realname));
    variants.push(mw.util.escapeRegExp(encodeURI(specialPageObj.realname)));
    specialPageObj.aliases.forEach((alias) => {
        variants.push(mw.util.escapeRegExp(alias));
        variants.push(mw.util.escapeRegExp(encodeURI(alias)));
    });
    return variants.join("|");
};
const setRegexps = () => {
    setMainRegex();
    const sp = nsRe(pg.nsSpecialId);
    pg.re.urlNoPopup = RegExp(`((title=|/)${sp}(?:%3A|:)|section=[0-9]|^#$)`);
    pg.wiki.specialpagealiases.forEach((specialpage: SpecialPageAlias) => {
        if (specialpage.realname === "Contributions") {
            pg.re.contribs = RegExp(`(title=|/)${sp}(?:%3A|:)(?:${buildSpecialPageGroup(specialpage)})(&target=|/|/${nsRe(pg.nsUserId)}:)(.*)`, "i");
        } else if (specialpage.realname === "Diff") {
            pg.re.specialdiff = RegExp(`/${sp}(?:%3A|:)(?:${buildSpecialPageGroup(specialpage)})/([^?#]*)`, "i");
        } else if (specialpage.realname === "Emailuser") {
            pg.re.email = RegExp(`(title=|/)${sp}(?:%3A|:)(?:${buildSpecialPageGroup(specialpage)})(&target=|/|/(?:${nsRe(pg.nsUserId)}:)?)(.*)`, "i");
        } else if (specialpage.realname === "Whatlinkshere") {
            pg.re.backlinks = RegExp(`(title=|/)${sp}(?:%3A|:)(?:${buildSpecialPageGroup(specialpage)})(&target=|/)([^&]*)`, "i");
        }
    });
    const im = nsReImage();
    pg.re.image = RegExp(`(^|\\[\\[)${im}: *([^|\\]]*[^|\\] ])([^0-9\\]]*([0-9]+) *px)?|(?:\\n *[|]?|[|]) *(${getValueOf("popupImageVarsRegexp")}) *= *(?:\\[\\[ *)?(?:${im}:)?([^|]*?)(?:\\]\\])? *[|]? *\\n`, "img");
    pg.re.imageBracketCount = 6;
    pg.re.category = RegExp(`\\[\\[${nsRe(pg.nsCategoryId)}: *([^|\\]]*[^|\\] ]) *`, "i");
    pg.re.categoryBracketCount = 1;
    pg.re.ipUser = RegExp("^(?::(?::|(?::[0-9A-Fa-f]{1,4}){1,7})|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6}::|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){7})|(((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9]))$");
    pg.re.stub = RegExp(getValueOf("popupStubRegexp") as string, "im");
    pg.re.disambig = RegExp(getValueOf("popupDabRegexp") as string, "im");
    pg.re.oldid = /[?&]oldid=([^&]*)/;
    pg.re.diff = /[?&]diff=([^&]*)/;
};
export const setupCache = () => {
    pg.cache.pages = [];
};
const setMisc = () => {
    pg.current.link = null;
    pg.current.links = [];
    pg.current.linksHash = {};
    setupCache();
    pg.timer.checkPopupPosition = null;
    pg.counter.loop = 0;
    pg.idNumber = 0;
    pg.misc.decodeExtras = [{
        from: "%2C",
        to: ",",
    }, {
        from: "_",
        to: " ",
    }, {
        from: "%24",
        to: "$",
    }, {
        from: "%26",
        to: "&",
    }];
};
export const getMwApi = (): mw.Api => {
    if (!pg.api.client) {
        pg.api.userAgent = `Navigation popups/1.0 (${mw.config.get("wgServerName")})`;
        pg.api.client = new mw.Api({
            ajax: {
                headers: {
                    "Api-User-Agent": pg.api.userAgent,
                },
            },
        });
    }
    return pg.api.client;
};
interface SetupPopups {
    (callback?: () => void): Promise<void>;
    completed?: boolean;
}
export const setupPopups: SetupPopups = async (callback?: () => void) => {
    if (setupPopups.completed) {
        if (typeof callback === "function") {
            callback();
        }
        return;
    }
    /**
         * No need to require dependencies by itself
         *
        mw.loader.using([
             "mediawiki.util",
             "mediawiki.api",
             "mediawiki.user",
             "user.options",
             "mediawiki.jqueryMsg",
        ].concat(mw.config.get("wgVersion").startsWith("1.31") ? ["mediawiki.api.messages"] : [])).then(fetchSpecialPageNames).then(() => {
         */
    await fetchSpecialPageNames();
    setupDebugging();
    setSiteInfo();
    setTitleBase();
    setOptions();
    setUserInfo();
    setNamespaces();
    setInterwiki();
    setRegexps();
    setRedirs();
    setMisc();
    setupLivePreview();
    setupTooltips();
    log("In setupPopups(), just called setupTooltips()");
    Navpopup.tracker.enable();

    setupPopups.completed = true;
    if (typeof callback === "function") {
        callback();
    }
};
