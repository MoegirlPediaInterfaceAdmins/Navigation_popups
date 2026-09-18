import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The banner mirrors the JS artifact header: provenance (@source oldid) and
// the do-not-copy / generated-file warnings.
const banner = `/**
 * @source https://en.wikipedia.org/wiki/MediaWiki:Gadget-navpop.css?oldid=825269631
 * 更新后请同步更新上面链接到最新版本
 */
/*
 * 样式内容引自 https://en.wikipedia.org/wiki/MediaWiki:Gadget-navpop.css
 * 当前版本相较于引述版本有大量定制，请不要直接复制粘贴新版本代码
 * 本文件由 Navigation_popups 仓库构建生成，请勿直接修改
 */
`;

export const build = async () => {
    const compiled = await sass.compileAsync(path.join(root, "src", "css", "main.scss"), {
        style: "expanded",
        // The sources ship in the repo; keeping URLs relative avoids
        // machine-specific absolute paths leaking into error reports.
        sourceMap: false,
    });
    let css = compiled.css.toString();
    // sass downlevels CSS Color 4 syntax back to legacy rgba() commas; the
    // stylelint standard preset (both repos) mandates modern notation, so the
    // artifact post-processes it back. Identical color values round-trip:
    // rgba(50, 50, 50, 0.35) === rgb(50 50 50 / 35%).
    css = css.replace(/rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/gu,
        (_, r, g, b, a) => `rgb(${r} ${g} ${b} / ${Math.round(+a * 100)}%)`);
    // stylelint (both repos) enforces an empty line before top-level at-rules;
    // sass expanded output puts consecutive @media blocks back to back.
    css = css.replace(/(^|\S)\n(@media)/gu, "$1\n\n$2");
    if (css.startsWith("﻿")) {
        throw new Error("BOM detected in CSS artifact");
    }
    if (css.includes("\r")) {
        throw new Error("CR (0x0d) detected in CSS artifact");
    }
    // sass expanded output carries no trailing newline; normalize it in.
    css = `${css.replace(/\n+$/u, "")}\n`;
    return Buffer.from(`${banner}${css}`, "utf8");
};

const distFile = path.join(root, "dist", "Gadget-popups.css");

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
                throw new Error("CSS build is not deterministic: two consecutive builds differ");
            }
            let onDisk = null;
            try {
                onDisk = await fs.promises.readFile(distFile);
            } catch {
                onDisk = null;
            }
            if (onDisk !== null && !first.equals(onDisk)) {
                throw new Error("dist/Gadget-popups.css on disk differs from a fresh build");
            }
            console.log(`CSS idempotency check passed (${first.length} bytes)`);
        } else {
            await write(first);
        }
    } catch (error) {
        console.error(error.message ?? error);
        process.exitCode = 1;
    }
}
