// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { nonGlobalRegex } from "./tools.ts";
    if (`${"abc".split(/(b)/)}` !== "a,b,c") {
        String.prototype.parenSplit = function (_re) {
            const re = nonGlobalRegex(_re);
            let s = this;
            let m = re.exec(s);
            let ret = [];
            while (m && s) {
                for (let i = 0; i < m.length; ++i) {
                    if (typeof m[i] === "undefined") {
                        m[i] = "";
                    }
                }
                ret.push(s.substring(0, m.index));
                ret = ret.concat(m.slice(1));
                s = s.substring(m.index + m[0].length);
                m = re.exec(s);
            }
            ret.push(s);
            return ret;
        };
    } else {
        String.prototype.parenSplit = function (re) {
            return this.split(re);
        };
        String.prototype.parenSplit.isNative = true;
    }
