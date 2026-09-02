import { startDownload } from "./downloader.ts";
import { pg } from "./globals.ts";
import { setupPopups } from "./init.ts";
import { popupString, tprintf } from "./strings.ts";
import { anyChild, getJsObj, simplePrintf } from "./tools.ts";
    const substitute = (data, cmdBody) => {
        const fromRe = RegExp(cmdBody.from, cmdBody.flags);
        return data.replace(fromRe, cmdBody.to);
    };
    const execCmds = (_data, cmdList) => {
        let data = _data;
        for (let i = 0; i < cmdList.length; ++i) {
            data = cmdList[i].action(data, cmdList[i]);
        }
        return data;
    };
    const parseCmd = (str) => {
        if (!str.length) {
            return [];
        }
        let p;
        switch (str.charAt(0)) {
            case "s":
                p = parseSubstitute(str);
                break;
            default:
                return false;
        }
        if (p) {
            return [p].concat(parseCmd(p.remainder));
        }
        return false;
    };
    const unEscape = (str, sep) => str.split("\\\\").join("\\").split(`\\${sep}`).join(sep).split("\\n").join("\n");
    const parseSubstitute = (_str) => {
        let str = _str;
        let from, to, flags, tmp;
        if (str.length < 4) {
            return false;
        }
        const sep = str.charAt(1);
        str = str.substring(2);
        tmp = skipOver(str, sep);
        if (tmp) {
            from = tmp.segment;
            str = tmp.remainder;
        } else {
            return false;
        }
        tmp = skipOver(str, sep);
        if (tmp) {
            to = tmp.segment;
            str = tmp.remainder;
        } else {
            return false;
        }
        flags = "";
        if (str.length) {
            tmp = skipOver(str, ";") || skipToEnd(str, ";");
            if (tmp) {
                flags = tmp.segment;
                str = tmp.remainder;
            }
        }
        return {
            action: substitute,
            from: from,
            to: to,
            flags: flags,
            remainder: str,
        };
    };
    const skipOver = (str, sep) => {
        const endSegment = findNext(str, sep);
        if (endSegment < 0) {
            return false;
        }
        const segment = unEscape(str.substring(0, endSegment), sep);
        return {
            segment: segment,
            remainder: str.substring(endSegment + 1),
        };
    };
    const skipToEnd = (str) => ({
        segment: str,
        remainder: "",
    });
    const findNext = (str, ch) => {
        for (let i = 0; i < str.length; ++i) {
            if (str.charAt(i) === "\\") {
                i += 2;
            }
            if (str.charAt(i) === ch) {
                return i;
            }
        }
        return -1;
    };
    const setCheckbox = (param, box) => {
        const val = mw.util.getParamValue(param);
        if (val) {
            switch (val) {
                case "1":
                case "yes":
                case "true":
                    box.checked = true;
                    break;
                case "0":
                case "no":
                case "false":
                    box.checked = false;
            }
        }
    };
    export const autoEdit = () => {
        if (!document.editform) {
            return false;
        }
        if (/Popups/.test(mw.util.getParamValue("wpChangeTags"))) {
            const wpChangeTags = document.createElement("input");
            wpChangeTags.type = "hidden";
            wpChangeTags.name = "wpChangeTags";
            wpChangeTags.value = "Popups";
            document.editform.append(wpChangeTags);
            document.editform.action += "&wpChangeTags=Popups";
            if (mw.util.getParamValue("autoclick") === "wpSave") {
                wpChangeTags.value += ",Automation tool";
                document.editform.action += "%2CAutomation%20tool";
            }
        }
        setupPopups(() => {
            if (mw.util.getParamValue("autoimpl") !== popupString("autoedit_version")) {
                return false;
            }
            if (mw.util.getParamValue("autowatchlist") && mw.util.getParamValue("actoken") === autoClickToken()) {
                pg.fn.modifyWatchlist(mw.util.getParamValue("title"), mw.util.getParamValue("action"));
            }
            if (!document.editform) {
                return false;
            }
            if (autoEdit.alreadyRan) {
                return false;
            }
            autoEdit.alreadyRan = true;
            const cmdString = mw.util.getParamValue("autoedit");
            if (cmdString) {
                try {
                    const editbox = document.editform.wpTextbox1;
                    const cmdList = parseCmd(cmdString);
                    const input = editbox.value;
                    const output = execCmds(input, cmdList);
                    editbox.value = output;
                } catch (dang) {
                    return;
                }
                if (typeof wikEdUseWikEd !== "undefined") {
                    if (wikEdUseWikEd === true) {
                        WikEdUpdateFrame();
                    }
                }
            }
            setCheckbox("autominor", document.editform.wpMinoredit);
            setCheckbox("autowatch", document.editform.wpWatchthis);
            const rvid = mw.util.getParamValue("autorv");
            if (rvid) {
                const url = `${pg.wiki.apiwikibase}?action=query&format=json&formatversion=2&prop=revisions&revids=${rvid}`;
                startDownload(url, null, autoEdit2);
            } else {
                autoEdit2();
            }
        });
    };
    const autoEdit2 = (d) => {
        let summary = mw.util.getParamValue("autosummary");
        let summaryprompt = mw.util.getParamValue("autosummaryprompt");
        let summarynotice = "";
        if (d && d.data && mw.util.getParamValue("autorv")) {
            const s = getRvSummary(summary, d.data);
            if (s === false) {
                summaryprompt = true;
                summarynotice = popupString("Failed to get revision information, please edit manually.\n\n");
                summary = simplePrintf(summary, [mw.util.getParamValue("autorv"), "(unknown)", "(unknown)"]);
            } else {
                summary = s;
            }
        }
        if (summaryprompt) {
            const txt = summarynotice + popupString("Enter a non-empty edit summary or press cancel to abort");
            const response = prompt(txt, summary);
            if (response) {
                summary = response;
            } else {
                return;
            }
        }
        if (summary) {
            document.editform.wpSummary.value = summary;
        }
        setTimeout(autoEdit3, 100);
    };
    export const autoClickToken = () => mw.user.sessionId();
    const autoEdit3 = () => {
        if (mw.util.getParamValue("actoken") !== autoClickToken()) {
            return;
        }
        const btn = mw.util.getParamValue("autoclick");
        if (btn) {
            if (document.editform && document.editform[btn]) {
                /**
                 * @type {HTMLButtonElement | HTMLInputElement}
                 */
                const button = document.editform[btn];
                const msg = tprintf("The %s button has been automatically clicked. Please wait for the next page to load.", [button.value]);
                bannerMessage(msg);
                document.title = `(${document.title})`;
                button.click();
            } else {
                alert(tprintf("Could not find button %s. Please check the settings in your javascript file.", [btn]));
            }
        }
    };
    const bannerMessage = (s) => {
        const headings = document.getElementsByTagName("h1");
        if (headings) {
            const div = document.createElement("div");
            div.innerHTML = `<font size=+1><b>${pg.escapeQuotesHTML(s)}</b></font>`;
            headings[0].parentNode.insertBefore(div, headings[0]);
        }
    };
    const getRvSummary = (template, json) => {
        try {
            const o = getJsObj(json);
            const edit = anyChild(o.query.pages).revisions[0];
            const timestamp = edit.timestamp.split(/[A-Z]/g).join(" ").replace(/^ *| *$/g, "");
            return simplePrintf(template, [edit.revid, timestamp, edit.userhidden ? "(hidden)" : edit.user]);
        } catch (badness) {
            return false;
        }
    };
