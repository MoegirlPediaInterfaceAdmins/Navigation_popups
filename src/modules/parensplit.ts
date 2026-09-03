import { nonGlobalRegex } from "./tools.ts";
type ParenSplit = ((this: string, re: RegExp | string) => string[]) & { isNative?: boolean };
if (String("abc".split(/(b)/)) !== "a,b,c") {
    String.prototype.parenSplit = function (this: string, _re: RegExp | string) {
        const re = nonGlobalRegex(_re as RegExp);
        let s = this.slice();
        let m = re.exec(s);
        let ret: string[] = [];
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
    const nativeSplit: ParenSplit = function (re) {
        return this.split(re);
    };
    nativeSplit.isNative = true;
    String.prototype.parenSplit = nativeSplit;
}
