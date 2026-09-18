import esbuild from "rollup-plugin-esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// The banner reproduces the header the original single-file gadget carried:
// eslint directives for the artifact, provenance and the do-not-copy warning.
// "use strict" is the artifact's only strict directive — build.js strips the
// per-module prologues esbuild injects, so this one survives alone.
// The artifact ships as bare top-level statements (format "es"): the gadget
// always reaches the wiki through mw.loader.implement, whose function scope
// isolates top-level names (var declarations included), so no IIFE wrapper
// is needed and the entry module has no imports/exports left to keep.
// Only two rules stay disabled here, both structural:
// - no-use-before-define: upstream orders helpers bottom-up; reordering the
//   mutually-recursive modules would change module evaluation order, which
//   the gadget depends on (sources disable it for the same reason).
// - camelcase: upstream identifiers and wiki/DOM contract names
//   (wpTextbox1, wikEdUseWikEd, last_attr…) are kept 1:1 so upstream
//   patches still apply.
// Everything else the es2020 target used to force (logical assignments, var
// in class-field helpers, esbuild's own formatting) is now taken care of at
// the source level (no `??=`/`||=` left) and by build.js, which runs the
// repo eslint with fix over the artifact and re-lints it as a gate — so any
// rule listed here must keep at least one real violation (an unused disable
// directive is itself an error). Keep the disable list free of continuation
// `*` prefixes: eslint splits it on commas and would read "* rule" as a
// rule name.
const banner = `/* eslint-disable no-use-before-define, camelcase */
/* global wikEdUseWikEd, WikEdUpdateFrame */
/**
 * @source https://en.wikipedia.org/_?oldid=1322962085
 * 更新后请同步更新上面链接到最新版本
 */
/*
 * 全部内容引自 https://en.wikipedia.org/wiki/MediaWiki:Gadget-popups.js
 * 当前版本相较于引述版本有大量优化，请不要直接复制粘贴新版本代码
 * 本文件由 Navigation_popups 仓库构建生成，请勿直接修改
 */
"use strict";`;

export default {
    input: `${root}src/entry.ts`,
    plugins: [
        esbuild({
            // es2020 matches the interface codes deploy side (tsc es2020 +
            // terser ecma 2020). See docs/semantic-notes.md for the downgrade
            // consequences (class fields become __publicField helpers).
            target: "es2020",
            // Type checking is done by tsc --noEmit as its own gate.
        }),
    ],
    // Everything is kept: the gadget intentionally retains upstream's dead
    // code and exact statement order; tree shaking is not wanted here.
    treeshake: false,
    onwarn: (warning, warn) => {
        // The upstream sources are one big mutually-recursive scope; cycles
        // are expected (all cross-module calls happen at runtime, after every
        // module body has been evaluated). Everything else is fatal.
        if (warning.code === "CIRCULAR_DEPENDENCY") {
            return;
        }
        warn(warning);
        throw new Error(`Unexpected rollup warning: ${warning.code ?? "UNKNOWN"}: ${warning.message}`);
    },
    output: {
        // Bare top-level statements: mw ResourceLoader wraps the script in
        // mw.loader.implement's function scope, which already isolates the
        // top-level names (see the banner note above). The entry module has
        // no imports/exports, so "es" emits a plain flat chunk.
        format: "es",
        banner,
        file: `${root}dist/Gadget-popups.js`,
        // terser on the interface codes side runs with toplevel:false and
        // keep_fnames/keep_classnames; there are no exports to preserve.
    },
};
