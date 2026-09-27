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
// Disable directives: no-use-before-define, camelcase, no-unused-vars,
// no-lone-blocks and @stylistic/multiline-ternary — exactly the rules the
// flattened artifact violates (verified by aggregating the verifier's full
// output, not by guesswork). Once rollup flattens the module graph, function
// bodies reference module-level singletons (and mutually recursive helpers
// across the whitelisted cycle set) in an order no-use-before-define cannot
// accept, while the zero-top-level-side-effects constraint keeps every
// reference inside function bodies — safe at runtime by construction.
// camelcase stays off because upstream contract identifiers are kept 1:1
// (same rationale as the src block in eslint.config.js); no-unused-vars
// because tree-shaking legitimately drops the last use of some parameters;
// the last two are rollup/esbuild output shape (scope wrapping, emitted
// formatting). The old port's banner carried the same mechanism with its
// own rule set (eslint.config.js's dist comment: rules the artifact cannot
// satisfy live in the banner). If a future edit genuinely needs another
// exemption, add it here — every rule listed must keep at least one real
// violation (an unused disable directive is itself an error; that is why
// the old port's no-var/prefer-const/logical-assignment-operators entries
// are NOT carried over: this artifact has no such violations). Keep the
// disable list free of continuation `*` prefixes: eslint splits it on
// commas and would read "* rule" as a rule name.
const banner = `/**
 * @source 行为基准 https://en.wikipedia.org/_?oldid=1322962085
 * 本文件为 Navigation_popups 仓库的重写实现（behavior-compatible rewrite），
 * 功能与上述基准及萌百定制版一致，请勿直接复制粘贴到其他 wiki
 * 本文件由构建生成，请勿直接修改
 */
/* eslint-disable no-use-before-define, camelcase, no-unused-vars, no-lone-blocks, @stylistic/multiline-ternary -- flattened artifact shape: no-use-before-define (function-body references interleave with declaration order; zero top-level side effects keeps them runtime-safe); camelcase (upstream contract identifiers wpTextbox1/autoedit_version kept 1:1); no-unused-vars (tree-shaking drops the last use of some parameters); no-lone-blocks and @stylistic/multiline-ternary (rollup/esbuild scope wrapping and emitted formatting) */
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
