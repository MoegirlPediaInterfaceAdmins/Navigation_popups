import esbuild from "rollup-plugin-esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// The banner carries the artifact's provenance and the do-not-copy warning.
// The implementation is a from-scratch behavior-compatible rewrite (see
// docs/semantic-notes.md), but it remains a derivative work of the upstream
// gadget the behavior baseline points at, so the @source attribution stays.
// "use strict" is the artifact's only strict directive — build.js strips the
// per-module prologues esbuild injects, so this one survives alone.
// The artifact ships as bare top-level statements (format "es"): the gadget
// always reaches the wiki through mw.loader.implement, whose function scope
// isolates top-level names (var declarations included), so no IIFE wrapper
// is needed and the entry module has no imports/exports left to keep.
// No eslint-disable directives: the rewrite emits no use-before-define or
// camelcase violations (the wiki contract names only appear as property
// accesses, which the camelcase rule does not check). If a future edit
// genuinely needs an exemption, add it here — every rule listed must keep
// at least one real violation (an unused disable directive is itself an
// error). Keep the disable list free of continuation `*` prefixes: eslint
// splits it on commas and would read "* rule" as a rule name.
const banner = `/**
 * @source 行为基准 https://en.wikipedia.org/_?oldid=1322962085
 * 本文件为 Navigation_popups 仓库的重写实现（behavior-compatible rewrite），
 * 功能与上述基准及萌百定制版一致，请勿直接复制粘贴到其他 wiki
 * 本文件由构建生成，请勿直接修改
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
    // The rewrite has no dead code to preserve, so tree shaking is enabled.
    treeshake: true,
    onwarn: (warning, warn) => {
        // The rewrite's architecture constraint is a cycle-free module graph:
        // the old port kept upstream's mutually-recursive scope on purpose,
        // the rewrite must not. Letting a cycle fail the build here is the
        // guard for that constraint (every other warning is fatal too).
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
