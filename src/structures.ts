// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { log, pg } from "./globals.ts";
import { navlinkStringToHTML } from "./navlinks.ts";
import { getValueOf } from "./options.ts";
import { popupString } from "./strings.ts";
    const copyStructure = (oldStructure, newStructure) => {
        pg.structures[newStructure] = {};
        for (const prop in pg.structures[oldStructure]) {
            pg.structures[newStructure][prop] = pg.structures[oldStructure][prop];
        }
    };
    copyStructure("original", "nostalgia");
    pg.structures.nostalgia.popupTopLinks = (x) => {
        let str = "";
        str += "<b><<mainlink|shortcut= >></b>";
        str += "if(user){<br><<contribs|shortcut=c>>";
        str += "if(wikimedia){*<<count|shortcut=#>>}";
        str += "if(ipuser){}else{*<<email|shortcut=E>>}if(admin){*<<block|shortcut=b>>}}";
        const editstr = "<<edit|shortcut=e>>";
        const editOldidStr = `if(oldid){<<editOld|shortcut=e>>|<<revert|shortcut=v|rv>>|<<edit|cur>>}else{${editstr}}`;
        const historystr = "<<history|shortcut=h>>";
        const watchstr = "<<unwatch|unwatchShort>>|<<watch|shortcut=w|watchThingy>>";
        str += `<br>if(talk){${editOldidStr}|<<new|shortcut=+>>*${historystr}*${watchstr}*<b><<article|shortcut=a>></b>|<<editArticle|edit>>}else{${editOldidStr}*${historystr}*${watchstr}*<b><<talk|shortcut=t>></b>|<<editTalk|edit>>|<<newTalk|shortcut=+|new>>}`;
        str += "<br><<whatLinksHere|shortcut=l>>*<<relatedChanges|shortcut=r>>";
        str += "if(admin){<br>}else{*}<<move|shortcut=m>>";
        str += "if(admin){*<<unprotect|unprotectShort>>|<<protect|shortcut=p>>*<<undelete|undeleteShort>>|<<delete|shortcut=d>>}";
        return navlinkStringToHTML(str, x.article, x.params);
    };
    pg.structures.nostalgia.popupRedirTopLinks = pg.structures.nostalgia.popupTopLinks;
    copyStructure("original", "fancy");
    pg.structures.fancy.popupTitle = (x) => navlinkStringToHTML("<font size=+0><<mainlink>></font>", x.article, x.params);
    pg.structures.fancy.popupTopLinks = (x) => {
        const hist = "<<history|shortcut=h|hist>>|<<lastEdit|shortcut=/|last>>|<<editors|shortcut=E|eds>>";
        const watch = "<<unwatch|unwatchShort>>|<<watch|shortcut=w|watchThingy>>";
        const move = "<<move|shortcut=m|move>>";
        return navlinkStringToHTML(`if(talk){<<edit|shortcut=e>>|<<new|shortcut=+|+>>*${hist}*<<article|shortcut=a>>|<<editArticle|edit>>*${watch}*${move}}else{<<edit|shortcut=e>>*${hist}*<<talk|shortcut=t|>>|<<editTalk|edit>>|<<newTalk|shortcut=+|new>>*${watch}*${move}}<br>`, x.article, x.params);
    };
    pg.structures.fancy.popupOtherLinks = (x) => {
        const admin = "<<unprotect|unprotectShort>>|<<protect|shortcut=p>>*<<undelete|undeleteShort>>|<<delete|shortcut=d|del>>";
        let user = "<<contribs|shortcut=c>>if(wikimedia){|<<count|shortcut=#|#>>}";
        user += `if(ipuser){|<<arin>>}else{*<<email|shortcut=E|${popupString("email")}>>}if(admin){*<<block|shortcut=b>>}`;
        const normal = "<<whatLinksHere|shortcut=l|links here>>*<<relatedChanges|shortcut=r|related>>";
        return navlinkStringToHTML(`<br>if(user){${user}*}if(admin){${admin}if(user){<br>}else{*}}${normal}`, x.article, x.params);
    };
    pg.structures.fancy.popupRedirTitle = pg.structures.fancy.popupTitle;
    pg.structures.fancy.popupRedirTopLinks = pg.structures.fancy.popupTopLinks;
    pg.structures.fancy.popupRedirOtherLinks = pg.structures.fancy.popupOtherLinks;
    copyStructure("fancy", "fancy2");
    pg.structures.fancy2.popupTopLinks = (x) => `<br>${pg.structures.fancy.popupTopLinks(x).replace(/<br>$/i, "")}`;
    pg.structures.fancy2.popupLayout = () => ["popupError", "popupImage", "popupTitle", "popupUserData", "popupData", "popupTopLinks", "popupOtherLinks", "popupRedir", ["popupWarnRedir", "popupRedirTopLinks", "popupRedirTitle", "popupRedirData", "popupRedirOtherLinks"], "popupMiscTools", ["popupRedlink"], "popupPrePreviewSep", "popupPreview", "popupSecondPreview", "popupPreviewMore", "popupPostPreview", "popupFixDab"];
    copyStructure("original", "menus");
    pg.structures.menus.popupLayout = () => ["popupError", "popupImage", "popupTopLinks", "popupTitle", "popupOtherLinks", "popupRedir", ["popupWarnRedir", "popupRedirTopLinks", "popupRedirTitle", "popupRedirData", "popupRedirOtherLinks"], "popupUserData", "popupData", "popupMiscTools", ["popupRedlink"], "popupPrePreviewSep", "popupPreview", "popupSecondPreview", "popupPreviewMore", "popupPostPreview", "popupFixDab"];
    pg.structures.menus.popupTopLinks = (x, shorter) => {
        const s = [];
        const dropclass = "popup_drop";
        const enddiv = "</div>";
        let hist = "<<history|shortcut=h>>";
        if (!shorter) {
            hist = `<menurow>${hist}|<<historyfeed|rss>>|<<editors|shortcut=E>></menurow>`;
        }
        const lastedit = "<<lastEdit|shortcut=/|show last edit>>";
        const thank = "if(diff){<<thank|send thanks>>}";
        const jsHistory = "<<lastContrib|last set of edits>><<sinceMe|changes since mine>>";
        const linkshere = "<<whatLinksHere|shortcut=l|what links here>>";
        const related = "<<relatedChanges|shortcut=r|related changes>>";
        const search = "<menurow><<search|shortcut=s>>if(wikimedia){|<<globalsearch|shortcut=g|global>>}|<<google|shortcut=G|web>></menurow>";
        const watch = "<menurow><<unwatch|unwatchShort>>|<<watch|shortcut=w|watchThingy>></menurow>";
        const protect = "<menurow><<unprotect|unprotectShort>>|<<protect|shortcut=p>>|<<protectlog|log>></menurow>";
        const del = "<menurow><<undelete|undeleteShort>>|<<delete|shortcut=d>>|<<deletelog|log>></menurow>";
        const move = "<<move|shortcut=m|move page>>";
        const nullPurge = "<menurow><<nullEdit|shortcut=n|null edit>>|<<purge|shortcut=P>></menurow>";
        const viewOptions = "<menurow><<view|shortcut=v>>|<<render|shortcut=S>>|<<raw>></menurow>";
        const editRow = "if(oldid){<menurow><<edit|shortcut=e>>|<<editOld|shortcut=e|this&nbsp;revision>></menurow><menurow><<revert|shortcut=v>>|<<undo>></menurow>}else{<<edit|shortcut=e>>}";
        const markPatrolled = "if(rcid){<<markpatrolled|mark patrolled>>}";
        const newTopic = "if(talk){<<new|shortcut=+|new topic>>}";
        const protectDelete = `if(admin){${protect}${del}}`;
        if (getValueOf("popupActionsMenu")) {
            s.push(`<<mainlink>>*${menuTitle(dropclass, "actions")}`);
        } else {
            s.push(`<div class="${dropclass}"><<mainlink>>`);
        }
        s.push("<menu>");
        s.push(editRow + markPatrolled + newTopic + hist + lastedit + thank);
        if (!shorter) {
            s.push(jsHistory);
        }
        s.push(move + linkshere + related);
        if (!shorter) {
            s.push(nullPurge + search);
        }
        if (!shorter) {
            s.push(viewOptions);
        }
        s.push(`<hr />${watch}${protectDelete}`);
        s.push(`<hr />if(talk){<<article|shortcut=a|view article>><<editArticle|edit article>>}else{<<talk|shortcut=t|talk page>><<editTalk|edit talk>><<newTalk|shortcut=+|new topic>>}</menu>${enddiv}`);
        const email = "<<email|shortcut=E|email user>>";
        const contribs = "if(wikimedia){<menurow>}<<contribs|shortcut=c|contributions>>if(wikimedia){</menurow>}if(admin){<menurow><<deletedContribs>></menurow>}";
        s.push(`if(user){*${menuTitle(dropclass, "user")}`);
        s.push("<menu>");
        s.push("<menurow><<userPage|shortcut=u|user&nbsp;page>>|<<userSpace|space>></menurow>");
        s.push("<<userTalk|shortcut=t|user talk>><<editUserTalk|edit user talk>><<newUserTalk|shortcut=+|leave comment>>");
        if (!shorter) {
            s.push(`if(ipuser){<<arin>>}else{${email}}`);
        } else {
            s.push(`if(ipuser){}else{${email}}`);
        }
        s.push(`<hr />${contribs}<<userlog|shortcut=L|user log>>`);
        s.push("if(wikimedia){<<count|shortcut=#|edit counter>>}");
        s.push("if(admin){<menurow><<unblock|unblockShort>>|<<block|shortcut=b|block user>></menurow>}");
        s.push("<<blocklog|shortcut=B|block log>>");
        s.push(`</menu>${enddiv}}`);
        if (getValueOf("popupSetupMenu") && !x.navpop.hasPopupMenu) {
            x.navpop.hasPopupMenu = true;
            s.push(`*${menuTitle(dropclass, "popupsMenu")}<menu>`);
            s.push("<<togglePreviews|toggle previews>>");
            s.push("<<purgePopups|reset>>");
            s.push("<<disablePopups|disable>>");
            s.push(`</menu>${enddiv}`);
        }
        return navlinkStringToHTML(s.join(""), x.article, x.params);
    };
    const menuTitle = (dropclass, s) => {
        const text = popupString(s); // i18n
        const len = text.length;
        return `<div class="${dropclass}" style="--navpop-m-len:${len}ch"><a href="#" noPopup=1>${text}</a>`;
    };
    pg.structures.menus.popupRedirTitle = pg.structures.menus.popupTitle;
    pg.structures.menus.popupRedirTopLinks = pg.structures.menus.popupTopLinks;
    copyStructure("menus", "shortmenus");
    pg.structures.shortmenus.popupTopLinks = (x) => pg.structures.menus.popupTopLinks(x, true);
    pg.structures.shortmenus.popupRedirTopLinks = pg.structures.shortmenus.popupTopLinks;
    pg.structures.lite = {};
    pg.structures.lite.popupLayout = () => ["popupTitle", "popupPreview"];
    pg.structures.lite.popupTitle = (x) => {
        log(`${x.article}: structures.lite.popupTitle`);
        return `<div><span class="popup_mainlink"><b>${x.article.toString()}</b></span></div>`;
    };
