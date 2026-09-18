import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import rollupOptions from "../rollup.config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await fs.promises.readFile(path.join(root, "build", "fragments.json"), "utf8"));
const distFile = path.join(root, manifest.artifact.output);
const { input, plugins, treeshake, onwarn, output } = rollupOptions;

const bundle = await rollup({ input, plugins, treeshake, onwarn });

export const build = async () => {
    // Every module listed in the manifest must be part of the bundle graph —
    // a module nobody imports would silently drop out otherwise.
    const moduleIds = bundle.cache.modules.map((m) => m.id.replaceAll("\\", "/"));
    const missing = manifest.modules
        .filter(({ file }) => !moduleIds.some((id) => id.endsWith(`/${file}`)))
        .map(({ file }) => file);
    if (missing.length > 0) {
        throw new Error(`modules missing from the bundle graph (add them to entry.ts imports): ${missing.join(", ")}`);
    }
    const generated = await bundle.generate(output);
    if (generated.output.length !== 1 || generated.output[0].type !== "chunk") {
        throw new Error(`expected a single output chunk, got ${generated.output.length}`);
    }
    const code = generated.output[0].code;
    if (code.startsWith("﻿")) {
        throw new Error("BOM detected in artifact");
    }
    if (code.includes("\r")) {
        throw new Error("CR (0x0d) detected in artifact");
    }
    if (/^\s*(?:import|export)\b/m.test(code)) {
        throw new Error("leftover module syntax in artifact");
    }
    if (!code.endsWith("\n")) {
        throw new Error("artifact must end with a newline");
    }
    return Buffer.from(code, "utf8");
};

const write = async (buf) => {
    await fs.promises.mkdir(path.dirname(distFile), { recursive: true });
    await fs.promises.writeFile(distFile, buf);
    console.log(`Built ${path.relative(root, distFile)} (${buf.length} bytes) from ${manifest.modules.length} modules`);
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
