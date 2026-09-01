// Verifies the concatenated artifact survives the same terser pass that
// MoegirlPediaInterfaceCodes runs on it during deployment (options copied
// from MoegirlPediaInterfaceCodes scripts/minification/options.js).
// The minified output is discarded; this is a parse/compress smoke gate.
/* eslint-disable camelcase -- terser options use snake_case */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "terser";

const options = {
    ecma: 2020,
    compress: {
        arrows: true,
        arguments: true,
        booleans: true,
        booleans_as_integers: false,
        collapse_vars: true,
        comparisons: true,
        computed_props: true,
        conditionals: true,
        dead_code: true,
        drop_console: false,
        drop_debugger: true,
        ecma: 2020,
        evaluate: true,
        expression: false,
        global_defs: {},
        hoist_funs: true,
        hoist_props: true,
        hoist_vars: false,
        if_return: true,
        inline: true,
        join_vars: true,
        keep_classnames: true,
        keep_fargs: true,
        keep_fnames: true,
        keep_infinity: true,
        lhs_constants: true,
        loops: true,
        module: false,
        negate_iife: true,
        passes: 3,
        properties: true,
        pure_funcs: [],
        pure_getters: "strict",
        pure_new: false,
        reduce_vars: true,
        reduce_funcs: true,
        sequences: true,
        side_effects: true,
        switches: true,
        toplevel: false,
        top_retain: null,
        typeofs: true,
        unsafe: false,
        unused: true,
    },
    mangle: {
        eval: false,
        keep_classnames: true,
        keep_fnames: true,
        module: false,
        properties: {
            builtins: false,
            keep_quoted: false,
            undeclared: false,
            regex: /^$/,
        },
    },
    format: {
        ascii_only: false,
        beautify: false,
        braces: false,
        comments: "some",
        ecma: 2020,
        indent_level: 4,
        indent_start: 0,
        inline_script: true,
        keep_numbers: false,
        keep_quoted_props: false,
        max_line_len: 1024 * 10,
        preamble: null,
        quote_keys: false,
        quote_style: 0,
        preserve_annotations: false,
        safari10: false,
        semicolons: true,
        shebang: false,
    },
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifact = path.join(root, "dist", "Gadget-popups.js");
const code = await fs.promises.readFile(artifact, "utf8");
const result = await minify(code, options);
if (typeof result.code !== "string" || result.code.length === 0) {
    throw new Error("terser returned empty output");
}
console.log(`terser OK: ${Buffer.byteLength(code, "utf8")} -> ${Buffer.byteLength(result.code, "utf8")} bytes (output discarded)`);
