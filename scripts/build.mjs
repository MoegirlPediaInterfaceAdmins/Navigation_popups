import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await fs.promises.readFile(path.join(root, "build", "fragments.json"), "utf8"));
const srcDir = path.join(root, "src");
const distFile = path.join(root, manifest.artifact.output);

// The gadget body is wrapped in a jQuery-ready callback that lives in the
// build layer (fragments must each be syntactically complete files). The
// double-load guard used to sit in main.js after the pg literal; it moves to
// the top of the wrapper — evaluating the pg literal has no side effects.
const WRAPPER_PREFIX = [
    "$(() => {",
    "    if (window.pg && !(window.pg instanceof HTMLElement)) {",
    "        return;",
    "    }",
    "",
].join("\n");
const WRAPPER_SUFFIX = "});\n";

const readFragment = async (name) => {
    const file = path.join(srcDir, name);
    const buf = await fs.promises.readFile(file);
    if (buf.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
        throw new Error(`${name}: BOM detected, fragments must be plain UTF-8`);
    }
    if (buf.includes(0x0d)) {
        throw new Error(`${name}: CR (0x0d) detected, fragments must use LF line endings`);
    }
    if (buf.length === 0 || buf.at(-1) !== 0x0a) {
        throw new Error(`${name}: fragment must end with exactly one newline`);
    }
    if (buf.length >= 2 && buf.at(-2) === 0x0a) {
        throw new Error(`${name}: fragment must not end with a blank line, fragments join with no separator`);
    }
    return buf;
};

export const build = async () => {
    const declared = manifest.fragments.map(({ file }) => file);
    const actual = (await fs.promises.readdir(srcDir)).filter((f) => f.endsWith(".js")).sort();
    const missing = declared.filter((f) => !actual.includes(f));
    const extra = actual.filter((f) => !declared.includes(f));
    if (missing.length > 0 || extra.length > 0) {
        const problems = [];
        if (missing.length > 0) {
            problems.push(`missing from src/: ${missing.join(", ")}`);
        }
        if (extra.length > 0) {
            problems.push(`present in src/ but not in the manifest: ${extra.join(", ")}`);
        }
        throw new Error(`src/ does not match build/fragments.json — ${problems.join("; ")}`);
    }
    const buffers = [];
    for (const [index, { file }] of manifest.fragments.entries()) {
        buffers.push(await readFragment(file));
        // The wrapper opens right after _header.js (comment header and the
        // global "use strict") — exactly where the original file had it —
        // and closes at the very end.
        if (index === 0) {
            buffers.push(Buffer.from(WRAPPER_PREFIX));
        }
    }
    buffers.push(Buffer.from(WRAPPER_SUFFIX));
    return Buffer.concat(buffers);
};

const write = async (buf) => {
    await fs.promises.mkdir(path.dirname(distFile), { recursive: true });
    await fs.promises.writeFile(distFile, buf);
    console.log(`Built ${path.relative(root, distFile)} (${buf.length} bytes) from ${manifest.fragments.length} fragments`);
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
