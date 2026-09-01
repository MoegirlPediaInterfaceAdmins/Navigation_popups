    const setPopupHTML = (str, elementId, _popupId, onSuccess, append) => {
        let popupId = _popupId;
        if (typeof popupId === "undefined") {
            popupId = pg.idNumber;
        }
        const popupElement = document.getElementById(elementId + popupId);
        if (popupElement) {
            if (!append) {
                popupElement.innerHTML = "";
            }
            if (isString(str)) {
                popupElement.innerHTML += str;
            } else {
                popupElement.appendChild(str);
            }
            if (onSuccess) {
                onSuccess();
            }
            setTimeout(checkPopupPosition, 100);
            return true;
        }
        setTimeout(() => {
            setPopupHTML(str, elementId, popupId, onSuccess);
        }, 600);
        return null;
    };
    const setPopupTrailer = (str, id) => setPopupHTML(str, "popupData", id);
    const fillEmptySpans = (args) => {
        let redir = true;
        let rcid;
        if (typeof args !== "object" || typeof args.redir === "undefined" || !args.redir) {
            redir = false;
        }
        const a = args.navpopup.parentAnchor;
        let article, hint = null,
            oldid = null,
            params = {};
        if (redir && typeof args.redirTarget === typeof {}) {
            article = args.redirTarget;
        } else {
            article = new Title().fromAnchor(a);
            hint = a.originalTitle || article.hintValue();
            params = parseParams(a.href);
            oldid = getValueOf("popupHistoricalLinks") ? params.oldid : null;
            rcid = params.rcid;
        }
        const x = {
            article: article,
            hint: hint,
            oldid: oldid,
            rcid: rcid,
            navpop: args.navpopup,
            params: params,
        };
        const structure = pg.structures[getValueOf("popupStructure")];
        if (typeof structure !== "object") {
            setPopupHTML("popupError", `Unknown structure (this should never happen): ${pg.option.popupStructure}`, args.navpopup.idNumber);
            return;
        }
        const spans = flatten(pg.misc.layout);
        const numspans = spans.length;
        const redirs = pg.misc.redirSpans;
        for (let i = 0; i < numspans; ++i) {
            const found = redirs && redirs.indexOf(spans[i]) !== -1;
            if (found && !redir || !found && redir) {
                continue;
            }
            const structurefn = structure[spans[i]];
            if (structurefn === undefined) {
                continue;
            }
            let setfn = setPopupHTML;
            if (getValueOf("popupActiveNavlinks") && (spans[i].indexOf("popupTopLinks") === 0 || spans[i].indexOf("popupRedirTopLinks") === 0)) {
                setfn = setPopupTipsAndHTML;
            }
            switch (typeof structurefn) {
                case "function":
                    log(`running ${spans[i]}({article:${x.article}, hint:${x.hint}, oldid: ${x.oldid}})`);
                    setfn(structurefn(x), spans[i], args.navpopup.idNumber);
                    break;
                case "string":
                    setfn(structurefn, spans[i], args.navpopup.idNumber);
                    break;
                default:
                    errlog(`unknown thing with label ${spans[i]} (span index was ${i})`);
                    break;
            }
        }
    };
    const flatten = (list, _start) => {
        let start = _start;
        const ret = [];
        if (typeof start === "undefined") {
            start = 0;
        }
        for (let i = start; i < list.length; ++i) {
            if (typeof list[i] === typeof []) {
                return ret.concat(flatten(list[i])).concat(flatten(list, i + 1));
            }
            ret.push(list[i]);
        }
        return ret;
    };
    const popupHTML = (a) => {
        getValueOf("popupStructure");
        const structure = pg.structures[pg.option.popupStructure];
        if (typeof structure !== "object") {
            pg.option.popupStructure = pg.optionDefault.popupStructure;
            return popupHTML(a);
        }
        if (typeof structure.popupLayout !== "function") {
            return "Bad layout";
        }
        pg.misc.layout = structure.popupLayout();
        if (typeof structure.popupRedirSpans === "function") {
            pg.misc.redirSpans = structure.popupRedirSpans();
        } else {
            pg.misc.redirSpans = [];
        }
        return makeEmptySpans(pg.misc.layout, a.navpopup);
    };
    const makeEmptySpans = (list, navpop) => {
        let ret = "";
        for (let i = 0; i < list.length; ++i) {
            if (typeof list[i] === typeof "") {
                ret += emptySpanHTML(list[i], navpop.idNumber, "div");
            } else if (typeof list[i] === typeof [] && list[i].length > 0) {
                ret = ret.parenSplit(RegExp("(</[^>]*?>$)")).join(makeEmptySpans(list[i], navpop));
            } else if (typeof list[i] === typeof {} && list[i].nodeType) {
                ret += emptySpanHTML(list[i].name, navpop.idNumber, list[i].nodeType);
            }
        }
        return ret;
    };
    const emptySpanHTML = (name, id, _tag, _classname) => {
        let classname = _classname;
        const tag = _tag || "span";
        if (!classname) {
            classname = emptySpanHTML.classAliases[name];
        }
        classname ||= name;
        if (name === getValueOf("popupDragHandle")) {
            classname += " popupDragHandle";
        }
        return simplePrintf('<%s id="%s" class="%s"></%s>', [tag, name + id, classname, tag]);
    };
    emptySpanHTML.classAliases = {
        popupSecondPreview: "popupPreview",
    };
    const imageHTML = (article, idNumber) => simplePrintf('<a id="popupImageLink$1"><img align="right" valign="top" id="popupImg$1" style="display: none;"></img></a>', [idNumber]);
    const popTipsSoonFn = (id, _when, popData) => {
        let when = _when;
        if (!when) {
            when = 250;
        }
        const popTips = () => {
            setupTooltips(document.getElementById(id), false, true, popData);
        };
        return () => {
            setTimeout(popTips, when, popData);
        };
    };
    const setPopupTipsAndHTML = (html, divname, idnumber, popData) => {
        setPopupHTML(html, divname, idnumber, getValueOf("popupSubpopups") ? popTipsSoonFn(divname + idnumber, null, popData) : null);
    };
