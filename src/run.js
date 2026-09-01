    const run = () => {
        autoEdit();
        setupPopups();
    };
    if (document.readyState === "complete") {
        run();
    } else {
        $(window).on("load", run);
    }
    (() => {
        let once = true;
        const dynamicContentHandler = ($content) => {
            if ($content.attr("id") === "mw-content-text") {
                if (once) {
                    once = false;
                    return;
                }
            }
            const registerHooksForVisibleNavpops = () => {
                for (let i = 0; pg.current.links && i < pg.current.links.length; ++i) {
                    const navpop = pg.current.links[i].navpopup;
                    if (!navpop || !navpop.isVisible()) {
                        continue;
                    }
                    Navpopup.tracker.addHook(posCheckerHook(navpop));
                }
            };
            const doIt = () => {
                registerHooksForVisibleNavpops();
                $content.each(function () {
                    this.ranSetupTooltipsAlready = false;
                    setupTooltips(this);
                });
            };
            setupPopups(doIt);
        };
        document.querySelectorAll(".mw-parser-output").forEach((content) => dynamicContentHandler($(content)));
        mw.hook("wikipage.content").add(dynamicContentHandler);
        mw.hook("ext.echo.overlay.beforeShowingOverlay").add(($overlay) => {
            dynamicContentHandler($overlay.find(".mw-echo-state"));
        });
    })();
