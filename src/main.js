    const pg = {
        api: {},
        re: {},
        ns: {},
        string: {},
        wiki: {},
        user: {},
        misc: {},
        option: {},
        optionDefault: {},
        flag: {},
        cache: {},
        structures: {},
        timer: {},
        counter: {},
        current: {},
        fn: {},
        endoflist: null,
    };
    window.pg = pg;
    if (!mw.util.escapeRegExp) {
        mw.util.escapeRegExp = mw.RegExp.escape;
    }
    const log = (...args) => window.popupDebug && console.log(...args);
    const errlog = (...args) => window.popupDebug && console.error(...args);
