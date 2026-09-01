    const delFmt = (x) => {
        if (!x.length) {
            return "";
        }
        return `<del class='popupDiff'>${x.join("")}</del>`;
    };
    const insFmt = (x) => {
        if (!x.length) {
            return "";
        }
        return `<ins class='popupDiff'>${x.join("")}</ins>`;
    };
    const countCrossings = (a, b, i, eject) => {
        if (!b[i].row && b[i].row !== 0) {
            return -1;
        }
        let count = 0;
        for (let j = 0; j < a.length; ++j) {
            if (!a[j].row && a[j].row !== 0) {
                continue;
            }
            if ((j - b[i].row) * (i - a[j].row) > 0) {
                if (eject) {
                    return true;
                }
                count++;
            }
        }
        return count;
    };
    const shortenDiffString = (str, context) => {
        const re = /(<del[\s\S]*?<\/del>|<ins[\s\S]*?<\/ins>)/;
        const splitted = str.parenSplit(re);
        let ret = [""];
        for (let i = 0; i < splitted.length; i += 2) {
            if (splitted[i].length < 2 * context) {
                ret[ret.length - 1] += splitted[i];
                if (i + 1 < splitted.length) {
                    ret[ret.length - 1] += splitted[i + 1];
                }
                continue;
            } else {
                if (i > 0) {
                    ret[ret.length - 1] += splitted[i].substring(0, context);
                }
                if (i + 1 < splitted.length) {
                    ret.push(splitted[i].substring(splitted[i].length - context) + splitted[i + 1]);
                }
            }
        }
        while (ret.length > 0 && !ret[0]) {
            ret = ret.slice(1);
        }
        return ret;
    };
    const diffString = (o, n, simpleSplit) => {
        const splitRe = /([[]{2}|[\]]{2}|[{]{2,3}|[}]{2,3}|[|]|=|<|>|[*:]+|\s|\b)/;
        let i, oSplitted, nSplitted;
        if (simpleSplit) {
            oSplitted = o.split(/\b/);
            nSplitted = n.split(/\b/);
        } else {
            oSplitted = o.parenSplit(splitRe);
            nSplitted = n.parenSplit(splitRe);
        }
        for (i = 0; i < oSplitted.length; ++i) {
            oSplitted[i] = oSplitted[i].entify();
        }
        for (i = 0; i < nSplitted.length; ++i) {
            nSplitted[i] = nSplitted[i].entify();
        }
        const out = diff(oSplitted, nSplitted);
        let str = "";
        let acc = [];
        let maxOutputPair = 0;
        for (i = 0; i < out.n.length; ++i) {
            if (out.n[i].paired) {
                if (maxOutputPair > out.n[i].row) {
                    out.o[out.n[i].row] = out.o[out.n[i].row].text;
                    out.n[i] = out.n[i].text;
                }
                if (maxOutputPair < out.n[i].row) {
                    maxOutputPair = out.n[i].row;
                }
            }
        }
        for (i = 0; i < out.o.length && !out.o[i].paired; ++i) {
            acc.push(out.o[i]);
        }
        str += delFmt(acc);
        acc = [];
        for (i = 0; i < out.n.length; ++i) {
            while (i < out.n.length && !out.n[i].paired) {
                acc.push(out.n[i++]);
            }
            str += insFmt(acc);
            acc = [];
            if (i < out.n.length) {
                str += out.n[i].text;
                let m = out.n[i].row + 1;
                while (m < out.o.length && !out.o[m].paired) {
                    acc.push(out.o[m++]);
                }
                str += delFmt(acc);
                acc = [];
            }
        }
        return str;
    };
    const jsReservedProperties = RegExp("^(constructor|prototype|__((define|lookup)[GS]etter)__|eval|hasOwnProperty|propertyIsEnumerable|to(Source|String|LocaleString)|(un)?watch|valueOf)$");
    const diffBugAlert = (word) => {
        if (!diffBugAlert.list[word]) {
            diffBugAlert.list[word] = 1;
            alert(`Bad word: ${word}\n\nPlease report this bug.`);
        }
    };
    diffBugAlert.list = {};
    const makeDiffHashtable = (src) => {
        const ret = {};
        for (let i = 0; i < src.length; i++) {
            if (jsReservedProperties.test(src[i])) {
                src[i] += "<!-- -->";
            }
            if (!ret[src[i]]) {
                ret[src[i]] = [];
            }
            try {
                ret[src[i]].push(i);
            } catch (err) {
                diffBugAlert(src[i]);
            }
        }
        return ret;
    };
    const diff = (o, n) => {
        const ns = makeDiffHashtable(n);
        const os = makeDiffHashtable(o);
        let i;
        for (i in ns) {
            if (ns[i].length === 1 && os[i] && os[i].length === 1) {
                n[ns[i][0]] = {
                    text: n[ns[i][0]],
                    row: os[i][0],
                    paired: true,
                };
                o[os[i][0]] = {
                    text: o[os[i][0]],
                    row: ns[i][0],
                    paired: true,
                };
            }
        }
        for (i = 0; i < n.length - 1; i++) {
            if (n[i].paired && !n[i + 1].paired && n[i].row + 1 < o.length && !o[n[i].row + 1].paired && n[i + 1] === o[n[i].row + 1]) {
                n[i + 1] = {
                    text: n[i + 1],
                    row: n[i].row + 1,
                    paired: true,
                };
                o[n[i].row + 1] = {
                    text: o[n[i].row + 1],
                    row: i + 1,
                    paired: true,
                };
            }
        }
        for (i = n.length - 1; i > 0; i--) {
            if (n[i].paired && !n[i - 1].paired && n[i].row > 0 && !o[n[i].row - 1].paired && n[i - 1] === o[n[i].row - 1]) {
                n[i - 1] = {
                    text: n[i - 1],
                    row: n[i].row - 1,
                    paired: true,
                };
                o[n[i].row - 1] = {
                    text: o[n[i].row - 1],
                    row: i - 1,
                    paired: true,
                };
            }
        }
        return {
            o: o,
            n: n,
        };
    };
