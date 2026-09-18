import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { rollup } from "rollup";
import rollupOptions from "../rollup.config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distFile = rollupOptions.output.file;
const { input, plugins, treeshake, onwarn, output } = rollupOptions;

// Holds the artifact to the repo's own lint config (the dist/** block of
// eslint.config.js): the build fixes and then verifies the artifact, so the
// banner only needs to carry exemptions that are structurally unavoidable.
const artifactFixer = new ESLint({ cwd: root, fix: true });
const artifactVerifier = new ESLint({ cwd: root });

const bundle = await rollup({ input, plugins, treeshake, onwarn });

export const build = async () => {
    const generated = await bundle.generate(output);
    if (generated.output.length !== 1 || generated.output[0].type !== "chunk") {
        throw new Error(`expected a single output chunk, got ${generated.output.length}`);
    }
    const code = generated.output[0].code;
    // esbuild injects a "use strict" prologue into every module because
    // alwaysStrict is inherited from the base tsconfig and TS 6.0 forbids
    // turning it off explicitly (TS5107), so the raw chunk carries one per
    // module. The banner already provides the artifact's only global
    // directive — strip the module-level ones from the body. The filter only
    // drops lines that are exactly the directive, and no source string
    // literal can produce such a line.
    const bannerPrefix = `${output.banner}\n`;
    if (!code.startsWith(bannerPrefix)) {
        throw new Error("artifact does not start with the configured banner");
    }
    const body = code
        .slice(bannerPrefix.length)
        .split("\n")
        .filter((line) => line !== '"use strict";')
        .join("\n");
    // esbuild renames self-referencing classes to a mangled `_X` binding and
    // leaves the original name as `let X = _X;`; the alias is never
    // reassigned, so promote it to const (prefer-const has no fixer — and if
    // esbuild ever drifts to another shape, the verify pass below catches it).
    let artifact = bannerPrefix + body.replace(/^let ([A-Z]\w*) = (_[A-Z]\w*);$/gm, "const $1 = $2;");
    // esbuild prints its own formatting; run the repo eslint with fix over
    // the artifact so it satisfies the same stylistic rules as the sources
    // instead of exempting them in the banner. The banner comment rides
    // along untouched (fixers never edit comments), keeping its directives
    // in effect for the pass.
    const [fixed] = await artifactFixer.lintText(artifact, { filePath: distFile });
    if (typeof fixed.output === "string") {
        artifact = fixed.output;
    }
    // Re-lint without fix: the build itself is the artifact's lint gate —
    // anything the banner does not legitimately disable fails the build.
    const [verify] = await artifactVerifier.lintText(artifact, { filePath: distFile });
    if (verify.errorCount > 0) {
        const first = verify.messages[0];
        throw new Error(`artifact lint failed: ${first.line}:${first.column} ${first.message} (${first.ruleId})`);
    }
    if (artifact.startsWith("﻿")) {
        throw new Error("BOM detected in artifact");
    }
    if (artifact.includes("\r")) {
        throw new Error("CR (0x0d) detected in artifact");
    }
    if (/^\s*(?:import|export)\b/m.test(artifact)) {
        throw new Error("leftover module syntax in artifact");
    }
    if (!artifact.endsWith("\n")) {
        throw new Error("artifact must end with a newline");
    }
    return Buffer.from(artifact, "utf8");
};

const write = async (buf) => {
    await fs.promises.mkdir(path.dirname(distFile), { recursive: true });
    await fs.promises.writeFile(distFile, buf);
    console.log(`Built ${path.relative(root, distFile)} (${buf.length} bytes)`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        const first = await build();
        if (process.argv.includes("--check-idempotent")) {
            const second = await build();
            if (!first.equals(second)) {
                throw new Error("build is not deterministic: two consecutive builds differ");
            }
            let onDisk = null;
            try {
                onDisk = await fs.promises.readFile(distFile);
            } catch {
                onDisk = null;
            }
            if (onDisk !== null && !first.equals(onDisk)) {
                throw new Error("dist/Gadget-popups.js on disk differs from a fresh build");
            }
            console.log(`Idempotency check passed (${first.length} bytes)`);
        } else {
            await write(first);
        }
    } catch (error) {
        console.error(error.message ?? error);
        process.exitCode = 1;
    }
}
