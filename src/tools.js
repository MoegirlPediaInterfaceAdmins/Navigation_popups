    const nonGlobalRegex = (re) => {
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
    const getJsObj = (json) => {
        try {
            const json_ret = JSON.parse(json);
            if (json_ret.warnings) {
                for (let w = 0; w < json_ret.warnings.length; w++) {
                    if (json_ret.warnings[w]["*"]) {
                        log(json_ret.warnings[w]["*"]);
                    } else {
                        log(json_ret.warnings[w].warnings);
                    }
                }
            } else if (json_ret.error) {
                errlog(`${json_ret.error.code}: ${json_ret.error.info}`);
            }
            return json_ret;
        } catch (someError) {
            errlog(`Something went wrong with getJsObj, json=${json}`);
            return 1;
        }
    };
    const anyChild = (obj) => {
        for (const p in obj) {
            return obj[p];
        }
        return null;
    };
    const upcaseFirst = (str) => {
        if (typeof str !== typeof "" || str === "") {
            return "";
        }
        return str.charAt(0).toUpperCase() + str.substring(1);
    };
    const literalizeRegex = (str) => mw.util.escapeRegExp(str);
    String.prototype.entify = function () {
        return this.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;");
    };
    const removeNulls = (val) => val !== null;
    const joinPath = (list) => list.filter(removeNulls).join("/");
    const simplePrintf = (str, subs) => {
        if (!str || !subs) {
            return str;
        }
        const ret = [];
        const s = str.parenSplit(/(%s|\$[0-9]+)/);
        let i = 0;
        do {
            ret.push(s.shift());
            if (!s.length) {
                break;
            }
            const cmd = s.shift();
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
    const isString = (x) => typeof x === "string" || x instanceof String;
    const isRegExp = (x) => x instanceof RegExp;
    const isArray = (x) => Array.isArray(x);
    const zeroFill = (n, l = 2) => `${n}`.padStart(l, "0");
    const map = (f, o) => {
        if (isArray(o)) {
            return map_array(f, o);
        }
        return map_object(f, o);
    };
    const map_array = (f, o) => {
        const ret = [];
        for (let i = 0; i < o.length; ++i) {
            ret.push(f(o[i]));
        }
        return ret;
    };
    const map_object = (f, o) => {
        const ret = {};
        for (const i in o) {
            ret[o] = f(o[i]);
        }
        return ret;
    };
    pg.escapeQuotesHTML = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    pg.unescapeQuotesHTML = (html) => {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    };
