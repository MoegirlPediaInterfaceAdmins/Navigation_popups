// One-shot migration: slice the original single-file gadget from
// MoegirlPediaInterfaceCodes into src/ fragments according to
// build/fragments.json, then verify the concatenation is byte-identical
// to the source file. Run from the repo root:
//   node scripts/migrate.mjs [path-to-Gadget-popups.js]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await fs.promises.readFile(path.join(root, "build", "fragments.json"), "utf8"));
const sourceFile = process.argv[2] ?? "/data/MoegirlPediaInterfaceCodes/src/gadgets/Navigation_popups/Gadget-popups.js";
const srcDir = path.join(root, "src");

const raw = await fs.promises.readFile(sourceFile);
if (raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) || raw.includes(0x0d) || raw.at(-1) !== 0x0a) {
    throw new Error("source file must be UTF-8 without BOM, LF-only, newline-terminated");
}
const lines = raw.toString("utf8").split("\n");
const totalLines = lines.length - 1;
console.log(`Source: ${sourceFile} (${totalLines} lines, ${raw.length} bytes)`);

// The manifest ranges must form a contiguous partition of 1..totalLines.
for (let i = 0; i < manifest.fragments.length; i++) {
    const { file, lines: [start, end] } = manifest.fragments[i];
    const expectedStart = i === 0 ? 1 : manifest.fragments[i - 1].lines[1] + 1;
    if (start !== expectedStart) {
        throw new Error(`${file}: starts at line ${start}, expected ${expectedStart} (ranges must be contiguous)`);
    }
    if (end < start) {
        throw new Error(`${file}: empty range [${start}, ${end}]`);
    }
}
const lastFragment = manifest.fragments.at(-1);
if (lastFragment.lines[1] !== totalLines) {
    throw new Error(`last fragment ${lastFragment.file} ends at ${lastFragment.lines[1]}, but the file has ${totalLines} lines`);
}

await fs.promises.mkdir(srcDir, { recursive: true });
for (const { file, lines: [start, end] } of manifest.fragments) {
    const content = `${lines.slice(start - 1, end).join("\n")}\n`;
    await fs.promises.writeFile(path.join(srcDir, file), content);
    console.log(`  src/${file}: lines ${start}-${end} (${end - start + 1} lines)`);
}

const artifact = await build();
if (artifact.equals(raw)) {
    console.log(`OK: concatenation of ${manifest.fragments.length} fragments is byte-identical to the source (${raw.length} bytes)`);
} else {
    let offset = 0;
    while (offset < Math.min(artifact.length, raw.length) && artifact[offset] === raw[offset]) {
        offset += 1;
    }
    console.error(`MISMATCH at byte ${offset}:`);
    console.error(`  built: ${JSON.stringify(artifact.subarray(offset - 60, offset + 60).toString("utf8"))}`);
    console.error(`  source: ${JSON.stringify(raw.subarray(offset - 60, offset + 60).toString("utf8"))}`);
    process.exitCode = 1;
}
