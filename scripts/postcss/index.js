// 对齐旧仓 scripts/postcss/index.js 的门禁语义（postcss 0 警告，警告计失败），
// 为本仓库精简重写：旧仓对 src/**/*.css 编译输出到 dist 并查警告；本仓库产物
// （dist/Gadget-popups.css）已由 build-css.js 生成，本检查对产物按同一份
// .postcssrc.yaml 插件链在内存中处理一遍，只收集 warnings、不落盘。
import fs from "node:fs";
import postcss from "postcss";
import postcssrc from "postcss-load-config";

const files = ["dist/Gadget-popups.css"];
const css = await Promise.all(files.map((file) => fs.promises.readFile(file, "utf8")));
const { plugins, options } = await postcssrc();

const warnings = [];
for (const [i, file] of files.entries()) {
    const result = await postcss(plugins).process(css[i], { ...options, from: file });
    for (const warning of result.warnings()) {
        warnings.push(`${file}:${warning.line}:${warning.column} ${warning.text}`);
    }
}

if (warnings.length > 0) {
    console.error("PostCSS has some warnings:");
    for (const warning of warnings) {
        console.error(`  ${warning}`);
    }
    process.exit(1);
}
console.info("PostCSS has no warnings.");
