    const popupHandleKeypress = (evt) => {
        const keyCode = window.event ? window.event.keyCode : evt.keyCode ? evt.keyCode : evt.which;
        if (!keyCode || !pg.current.link || !pg.current.link.navpopup) {
            return;
        }
        if (keyCode === 27) {
            killPopup();
            return false;
        }
        const letter = String.fromCharCode(keyCode);
        const links = pg.current.link.navpopup.mainDiv.getElementsByTagName("A");
        let startLink = 0;
        let i, j;
        if (popupHandleKeypress.lastPopupLinkSelected) {
            for (i = 0; i < links.length; ++i) {
                if (links[i] === popupHandleKeypress.lastPopupLinkSelected) {
                    startLink = i;
                }
            }
        }
        for (j = 0; j < links.length; ++j) {
            i = (startLink + j + 1) % links.length;
            if (links[i].getAttribute("popupkey") === letter) {
                if (evt && evt.preventDefault) {
                    evt.preventDefault();
                }
                links[i].trigger("focus");
                popupHandleKeypress.lastPopupLinkSelected = links[i];
                return false;
            }
        }
        if (document.oldPopupOnkeypress) {
            return document.oldPopupOnkeypress(evt);
        }
        return true;
    };
    const addPopupShortcuts = () => {
        if (document.onkeypress !== popupHandleKeypress) {
            document.oldPopupOnkeypress = document.onkeypress;
        }
        document.onkeypress = popupHandleKeypress;
    };
    const rmPopupShortcuts = () => {
        popupHandleKeypress.lastPopupLinkSelected = null;
        try {
            if (document.oldPopupOnkeypress && document.oldPopupOnkeypress === popupHandleKeypress) {
                document.onkeypress = null;
                return;
            }
            document.onkeypress = document.oldPopupOnkeypress;
        } catch { }
    };
    const addLinkProperty = (html, property) => {
        const i = html.indexOf(">");
        if (i < 0) {
            return html;
        }
        return `${html.substring(0, i)} ${property}${html.substring(i)}`;
    };
    const addPopupShortcut = (html, _key) => {
        let key = _key;
        if (!getValueOf("popupShortcutKeys")) {
            return html;
        }
        const ret = addLinkProperty(html, `popupkey="${key}"`);
        if (key === " ") {
            key = popupString("spacebar");
        }
        return ret.replace(/^(.*?)(title=")(.*?)(".*)$/i, `$1$2$3 [${key}]$4`);
    };
