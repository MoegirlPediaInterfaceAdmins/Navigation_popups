import type { Downloader } from "./downloader.ts";
import { startDownload } from "./downloader.ts";
import { pg } from "./globals.ts";
import { setupPopups } from "./init.ts";
import { popupString, tprintf } from "./strings.ts";
import { anyChild, assume, getJsObj, simplePrintf } from "./tools.ts";
interface EditCmd {
    action: (data: string, cmdBody: EditCmd) => string;
    from: string;
    to: string;
    flags: string;
    remainder: string;
}
const substitute = (data: string, cmdBody: EditCmd) => {
    const fromRe = RegExp(cmdBody.from, cmdBody.flags);
    return data.replace(fromRe, cmdBody.to);
};
const execCmds = (_data: string, cmdList: false | EditCmd[]): string => {
    let data = _data;
    if (!cmdList) {
        return data;
    }
    for (const cmd of cmdList) {
        data = cmd.action(data, cmd);
    }
    return data;
};
const parseCmd = (str: string): false | EditCmd[] => {
    if (!str.length) {
        return [];
    }
    let p: false | EditCmd;
    switch (str.charAt(0)) {
        case "s":
            p = parseSubstitute(str);
            break;
        default:
            return false;
    }
    if (p) {
        return [p].concat(parseCmd(p.remainder) as EditCmd[]);
    }
    return false;
};
const unEscape = (str: string, sep: string) => str.split("\\\\").join("\\").split(`\\${sep}`).join(sep).split("\\n").join("\n");
const parseSubstitute = (_str: string): false | EditCmd => {
    let str = _str;
    let from: string, to: string, flags: string, tmp: false | { segment: string; remainder: string };
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
        tmp = skipOver(str, ";") || skipToEnd(str);
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
const skipOver = (str: string, sep: string): false | { segment: string; remainder: string } => {
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
const skipToEnd = (str: string): { segment: string; remainder: string } => ({
    segment: str,
    remainder: "",
});
const findNext = (str: string, ch: string) => {
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
const setCheckbox = (param: string, box: HTMLInputElement | undefined) => {
    const val = mw.util.getParamValue(param);
    if (val && box) {
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
export const autoEdit: (() => void) & { alreadyRan?: boolean } = () => {
    if (!document.editform) {
        return false;
    }
    if ((mw.util.getParamValue("wpChangeTags") ?? "").includes("Popups")) {
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
    void setupPopups(() => {
        if (mw.util.getParamValue("autoimpl") !== popupString("autoedit_version")) {
            return false;
        }
        if (mw.util.getParamValue("autowatchlist") && mw.util.getParamValue("actoken") === autoClickToken()) {
            void pg.fn.modifyWatchlist?.(mw.util.getParamValue("title"), mw.util.getParamValue("action"));
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
                if (!editbox) {
                    return;
                }
                const cmdList = parseCmd(cmdString);
                const input = editbox.value;
                const output = execCmds(input, cmdList);
                editbox.value = output;
            } catch {
                return;
            }
            if (typeof wikEdUseWikEd !== "undefined") {
                if (wikEdUseWikEd) {
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
const autoEdit2 = (d?: Downloader) => {
    let summary = mw.util.getParamValue("autosummary");
    let summaryprompt: string | null | boolean = mw.util.getParamValue("autosummaryprompt");
    let summarynotice = "";
    if (d?.data && mw.util.getParamValue("autorv")) {
        const s = getRvSummary(summary, d.data);
        if (s === false) {
            summaryprompt = true;
            summarynotice = popupString("Failed to get revision information, please edit manually.\n\n");
            summary = simplePrintf(assume(summary), [mw.util.getParamValue("autorv"), "(unknown)", "(unknown)"]);
        } else {
            summary = s;
        }
    }
    if (summaryprompt) {
        const txt = summarynotice + popupString("Enter a non-empty edit summary or press cancel to abort");
        const response = prompt(txt, summary as string | undefined);
        if (response) {
            summary = response;
        } else {
            return;
        }
    }
    if (summary) {
        if (document.editform?.wpSummary) {
            document.editform.wpSummary.value = summary;
        }
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
        if (document.editform?.[btn]) {
            const button = document.editform[btn] as HTMLButtonElement | HTMLInputElement;
            const msg = tprintf("The %s button has been automatically clicked. Please wait for the next page to load.", [button.value]);
            bannerMessage(msg);
            document.title = `(${document.title})`;
            button.click();
        } else {
            alert(tprintf("Could not find button %s. Please check the settings in your javascript file.", [btn]));
        }
    }
};
const bannerMessage = (s: string) => {
    const headings = document.getElementsByTagName("h1");
    if (headings) {
        const div = document.createElement("div");
        div.innerHTML = `<font size=+1><b>${pg.escapeQuotesHTML?.(s) ?? ""}</b></font>`;
        headings[0].parentNode?.insertBefore(div, headings[0]);
    }
};
interface RvPage {
    revisions?: { timestamp: string; revid: number; user: string; userhidden?: boolean }[];
}
const getRvSummary = (template: string | null, json: string | undefined): false | string => {
    try {
        const o = getJsObj(json ?? "") as { query?: { pages?: Record<string, RvPage> } };
        const edit = anyChild(o.query?.pages ?? {});
        const revision = edit?.revisions?.[0];
        if (!revision) {
            return false;
        }
        const timestamp = revision.timestamp.split(/[A-Z]/g).join(" ").replace(/^ *| *$/g, "");
        return simplePrintf(assume(template), [revision.revid, timestamp, revision.userhidden ? "(hidden)" : revision.user]);
    } catch {
        return false;
    }
};
