import { errlog, log, pg } from "../globals.ts";
export const nonGlobalRegex = (re: RegExp) => {
    const s = re.toString();
    let flags = "";
    let j = s.length;
    for (; s.charAt(j) !== "/"; --j) {
        if (s.charAt(j) !== "g") {
            flags += s.charAt(j);
        }
    }
    const t = s.substring(1, j);
    return RegExp(t, flags);
};
export const getJsObj = (json: string): object | 1 => {
    try {
        const json_ret = JSON.parse(json) as { warnings?: { "*": string; warnings: string }[]; error?: { code: string; info: string } } & object;
        if (json_ret.warnings) {
            for (const warning of json_ret.warnings) {
                if (warning["*"]) {
                    log(warning["*"]);
                } else {
                    log(warning.warnings);
                }
            }
        } else if (json_ret.error) {
            errlog(`${json_ret.error.code}: ${json_ret.error.info}`);
        }
        return json_ret;
    } catch {
        errlog(`Something went wrong with getJsObj, json=${json}`);
        return 1;
    }
};
export const anyChild = <T>(obj: Record<string, T>) => {
    for (const p in obj) {
        return obj[p];
    }
    return null;
};
export const upcaseFirst = (str: string) => {
    if (typeof str !== "string" || str === "") {
        return "";
    }
    return str.charAt(0).toUpperCase() + str.substring(1);
};
export const literalizeRegex = (str: string) => mw.util.escapeRegExp(str);
String.prototype.entify = function () {
    return this.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;");
};
const removeNulls = (val: string | null) => val !== null;
export const joinPath = (list: (string | null)[]) => list.filter(removeNulls).join("/");
export const simplePrintf = (str: string, subs: unknown[]) => {
    if (!str) {
        return str;
    }
    const ret: unknown[] = [];
    const s = str.parenSplit(/(%s|\$[0-9]+)/);
    let i = 0;
    do {
        ret.push(s.shift() ?? "");
        if (!s.length) {
            break;
        }
        const cmd = s.shift() ?? "";
        if (cmd === "%s") {
            if (i < subs.length) {
                ret.push(subs[i]);
            } else {
                ret.push(cmd);
            }
            ++i;
        } else {
            const j = parseInt(cmd.replace("$", ""), 10) - 1;
            if (j > -1 && j < subs.length) {
                ret.push(subs[j]);
            } else {
                ret.push(cmd);
            }
        }
    } while (s.length > 0);
    return ret.join("");
};
export const isString = (x: unknown) => typeof x === "string" || x instanceof String;
export const isRegExp = (x: unknown) => x instanceof RegExp;
const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
// Identity at runtime; documents that the caller guarantees a non-nullish
// value (an upstream runtime invariant the types cannot carry). Crashes
// exactly where the untyped original would.
export const assume = <T>(value: T | null | undefined): T => value as unknown as T;

export const zeroFill = (n: number, l = 2) => `${n}`.padStart(l, "0");
export const map = <T, U>(f: (x: T) => U, o: T[] | Record<string, T>): U[] | Record<string, U> => {
    if (isArray(o)) {
        return map_array(f, o);
    }
    return map_object(f, o as Record<string, never>);
};
const map_array = <T, U>(f: (x: T) => U, o: T[]): U[] => {
    const ret: U[] = [];
    for (const item of o) {
        ret.push(f(item));
    }
    return ret;
};
const map_object = <T, U>(f: (x: T) => U, o: Record<string, T>): Record<string, U> => {
    const ret: Record<string, U> = {};
    for (const i in o) {
        // upstream indexes by the object itself (implicit string key); kept verbatim
        // eslint-disable-next-line @typescript-eslint/no-base-to-string -- upstream bug kept verbatim: keys by the object itself
        ret[String(o)] = f(o[i]);
    }
    return ret;
};
pg.escapeQuotesHTML = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
pg.unescapeQuotesHTML = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
};
