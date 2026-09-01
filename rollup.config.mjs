import esbuild from "rollup-plugin-esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// The banner reproduces the header the original single-file gadget carried:
// eslint directives for the artifact, provenance and the do-not-copy warning.
// "use strict" sits at the very top of the file (outside the IIFE), exactly
// where the original had it.
const banner = `/* eslint-disable no-unused-vars, no-use-before-define, camelcase */
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
            target: "es2022",
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
        format: "iife",
        banner,
        file: `${root}dist/Gadget-popups.js`,
        // terser on the interface codes side runs with toplevel:false and
        // keep_fnames/keep_classnames; there are no exports to preserve.
    },
};
