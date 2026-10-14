import esbuild from "rollup-plugin-esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// The banner only carries the generated-file warning, the repo URL and the
// strict directive; upstream provenance (the behavior-baseline oldid) lives
// in the README's 来源与授权 section.
// "use strict" is the artifact's only strict directive — build.js strips the
// per-module prologues esbuild injects, so this one survives alone.
// The artifact ships as bare top-level statements (format "es"): the gadget
// always reaches the wiki through mw.loader.implement, whose function scope
// isolates top-level names (var declarations included), so no IIFE wrapper
// is needed and the entry module has no imports/exports left to keep.
// No eslint directives ride in the banner: the interface codes deploy side
// auto-creates an .eslintignore covering the synced artifact, so nothing
// downstream ever lints it. The rules the flattened output cannot satisfy
// (no-use-before-define, camelcase, no-unused-vars, no-lone-blocks,
// @stylistic/multiline-ternary) live in the dist/** block of
// eslint.config.js, which is what build.js's fix/verify passes lint through.
const banner = `/**
 * 本文件由 Navigation_popups 仓库构建生成，请勿直接修改
 * 仓库地址：https://github.com/MoegirlPediaInterfaceAdmins/Navigation_popups
 */
"use strict";`;

// Modules allowed to participate in rollup-reported cycles (see onwarn).
// Current cycle inventory (collected via a probe run against rollup's API):
// options↔pageinfo; events↔selection; events↔shortcutkeys; queries↔pipeline;
// pipeline↔images; events→dispatch→queries(+pipeline/images|dab/links)→events.
// diffpreview sits in the same strongly connected component (SCC analysis)
// even though the shortest reported paths omit it.
const KNOWN_CYCLE_MODULES = new Set([
    "src/core/options.ts",
    "src/core/events.ts",
    "src/core/selection.ts",
    "src/core/shortcutkeys.ts",
    "src/api/queries.ts",
    "src/preview/pipeline.ts",
    "src/preview/images.ts",
    "src/preview/pageinfo.ts",
    "src/preview/dispatch.ts",
    "src/preview/dab.ts",
    "src/preview/diffpreview.ts",
    "src/navlinks/links.ts",
]);

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
    // The rewrite's architecture constraint is "zero top-level side effects":
    // module bodies only define functions and constants, never evaluate a
    // cross-module binding at top level. Under that constraint function-level
    // cycles are safe at runtime (verified: the artifact evaluates cleanly in
    // jsdom with boot completing end to end), and the preview/event domains
    // are mutually recursive by nature — upstream's original design, which
    // the old port whitelisted on purpose. Forcing an acyclic graph would
    // mean registry seams across five already-locked domains with zero
    // runtime benefit. Instead, cycles confined to KNOWN_CYCLE_MODULES are
    // allowed; any cycle reaching outside the set stays fatal, so a future
    // cycle (e.g. a top-level-evaluation regression) cannot sneak in silently.
    onwarn: (warning, warn) => {
        if (warning.code === "CIRCULAR_DEPENDENCY") {
            const cycleModules = warning.message.split("Circular dependency: ")[1]?.split(" -> ") ?? [];
            if (cycleModules.length > 0 && cycleModules.every((m) => KNOWN_CYCLE_MODULES.has(m))) {
                return;
            }
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
