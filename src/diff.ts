export interface DiffEntry {
    text?: string;
    row?: number;
    paired?: boolean;
}
export type DiffCell = string | DiffEntry;
const textOf = (x: DiffCell): string => typeof x === "string" ? x : x.text ?? "";
export const entryOf = (x: DiffCell): DiffEntry => typeof x === "string" ? { text: x } : x;
const delFmt = (x: DiffCell[]) => {
    if (!x.length) {
        return "";
    }
    return `<del class='popupDiff'>${x.map(textOf).join("")}</del>`;
};
const insFmt = (x: DiffCell[]) => {
    if (!x.length) {
        return "";
    }
    return `<ins class='popupDiff'>${x.map(textOf).join("")}</ins>`;
};
export const countCrossings = (a: DiffCell[], b: DiffCell[], i: number, eject?: boolean) => {
    const bEntry = entryOf(b[i]);
    if (!bEntry.row && bEntry.row !== 0) {
        return -1;
    }
    let count = 0;
    for (let j = 0; j < a.length; ++j) {
        const aEntry = entryOf(a[j]);
        if (!aEntry.row && aEntry.row !== 0) {
            continue;
        }
        if ((j - (bEntry.row ?? Number.NaN)) * (i - (aEntry.row ?? Number.NaN)) > 0) {
            if (eject) {
                return true;
            }
            count++;
        }
    }
    return count;
};
export const shortenDiffString = (str: string, context: number) => {
    const re = /(<del[\s\S]*?<\/del>|<ins[\s\S]*?<\/ins>)/;
    const splitted = str.parenSplit(re);
    let ret: string[] = [""];
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
export const diffString = (o: string, n: string, simpleSplit?: boolean) => {
    const splitRe = /([[]{2}|[\]]{2}|[{]{2,3}|[}]{2,3}|[|]|=|<|>|[*:]+|\s|\b)/;
    let i: number, oSplitted: string[], nSplitted: string[];
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
    let acc: DiffCell[] = [];
    let maxOutputPair = 0;
    for (i = 0; i < out.n.length; ++i) {
        const nEntry = entryOf(out.n[i]);
        if (nEntry.paired && typeof nEntry.row === "number") {
            if (maxOutputPair > nEntry.row) {
                out.o[nEntry.row] = textOf(out.o[nEntry.row]);
                out.n[i] = textOf(out.n[i]);
            }
            if (maxOutputPair < nEntry.row) {
                maxOutputPair = nEntry.row;
            }
        }
    }
    for (i = 0; i < out.o.length && !entryOf(out.o[i]).paired; ++i) {
        acc.push(out.o[i]);
    }
    str += delFmt(acc);
    acc = [];
    for (i = 0; i < out.n.length; ++i) {
        while (i < out.n.length && !entryOf(out.n[i]).paired) {
            acc.push(out.n[i++]);
        }
        str += insFmt(acc);
        acc = [];
        if (i < out.n.length) {
            str += textOf(out.n[i]);
            let m = (entryOf(out.n[i]).row ?? -1) + 1;
            while (m < out.o.length && !entryOf(out.o[m]).paired) {
                acc.push(out.o[m++]);
            }
            str += delFmt(acc);
            acc = [];
        }
    }
    return str;
};
const jsReservedProperties = RegExp("^(constructor|prototype|__((define|lookup)[GS]etter)__|eval|hasOwnProperty|propertyIsEnumerable|to(Source|String|LocaleString)|(un)?watch|valueOf)$");
interface DiffBugAlert {
    (word: string): void;
    list: Record<string, number>;
}
const diffBugAlert = (word: string) => {
    if (!diffBugAlert.list[word]) {
        diffBugAlert.list[word] = 1;
        alert(`Bad word: ${word}\n\nPlease report this bug.`);
    }
};
diffBugAlert.list = {} as Record<string, number>;
const makeDiffHashtable = (src: DiffCell[]) => {
    const ret: Record<string, number[]> = {};
    for (let i = 0; i < src.length; i++) {
        const key = textOf(src[i]);
        if (jsReservedProperties.test(key)) {
            src[i] = `${key}<!-- -->`;
        }
        if (!ret[key]) {
            ret[key] = [];
        }
        try {
            ret[key].push(i);
        } catch (err) {
            diffBugAlert(key);
        }
    }
    return ret;
};
export const diff = (o: DiffCell[], n: DiffCell[]): { o: DiffCell[]; n: DiffCell[] } => {
    const ns = makeDiffHashtable(n);
    const os = makeDiffHashtable(o);
    let i: string | number;
    for (i in ns) {
        if (ns[i].length === 1 && os[i] && os[i].length === 1) {
            n[ns[i][0]] = {
                text: textOf(n[ns[i][0]]),
                row: os[i][0],
                paired: true,
            };
            o[os[i][0]] = {
                text: textOf(o[os[i][0]]),
                row: ns[i][0],
                paired: true,
            };
        }
    }
    for (i = 0; i < n.length - 1; i++) {
        const entry = entryOf(n[i]);
        const row = entry.row ?? -1;
        if (entry.paired && !entryOf(n[i + 1]).paired && row + 1 < o.length && !entryOf(o[row + 1]).paired && textOf(n[i + 1]) === textOf(o[row + 1])) {
            n[i + 1] = {
                text: textOf(n[i + 1]),
                row: row + 1,
                paired: true,
            };
            o[row + 1] = {
                text: textOf(o[row + 1]),
                row: i + 1,
                paired: true,
            };
        }
    }
    for (i = n.length - 1; i > 0; i--) {
        const entry = entryOf(n[i]);
        const row = entry.row ?? -1;
        if (entry.paired && !entryOf(n[i - 1]).paired && row > 0 && !entryOf(o[row - 1]).paired && textOf(n[i - 1]) === textOf(o[row - 1])) {
            n[i - 1] = {
                text: textOf(n[i - 1]),
                row: row - 1,
                paired: true,
            };
            o[row - 1] = {
                text: textOf(o[row - 1]),
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
