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
