// Release entry point: validate the version, run the full gate suite, then
// push an annotated tag. The GitHub Release itself is created afterwards by
// .github/workflows/release.yml, which triggers on v* tag pushes.
import { spawnSync } from "node:child_process";
import semver from "semver";

const usage = "用法: npm run release -- v1.2.3";

const runGit = (args) => {
    const { error, status, stdout, stderr } = spawnSync("git", args, { encoding: "utf8" });
    if (error) {
        console.error(`✗ 无法执行 git：${error.message}`);
        process.exit(1);
    }
    if (status !== 0) {
        console.error(`✗ git ${args.join(" ")} 失败（退出码 ${status}）：`);
        console.error(stderr.trim());
        process.exit(1);
    }
    return stdout;
};

// Every rejection that is about the version number itself carries the same
// hint block, so the caller can pick the next candidate without a lookup.
const fail = (message, latest) => {
    console.error(`✗ ${message}`);
    console.error("");
    if (latest === null) {
        console.error("仓库尚无任何 tag（首次发版），版本号可任选（建议 v1.0.0）。");
    } else {
        console.error(`当前最新版本: v${latest}`);
        console.error("下个版本候选:");
        for (const level of ["major", "minor", "patch"]) {
            console.error(`  ${level} → v${semver.inc(latest, level)}`);
        }
    }
    process.exit(1);
};

// A tag may exist on only one side (created locally but not pushed, or
// fetched after a remote release), so the two sources are merged before
// checking existence or computing the maximum version.
const tags = new Set([
    ...runGit(["tag", "-l"]).split("\n").filter((line) => line !== ""),
    ...runGit(["ls-remote", "--tags", "origin"]).split("\n")
        // ^{} lines are the peeled refs (commit behind an annotated tag);
        // stripping the suffix makes them deduplicate with their own tag.
        .map((line) => line.split("\t")[1]?.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, ""))
        .filter((name) => !!name),
]);
const versions = [...tags]
    .map((tag) => tag.startsWith("v") ? semver.valid(tag.slice(1)) : null)
    .filter((version) => version !== null);
const latest = versions.length > 0
    ? versions.reduce((max, version) => semver.gt(version, max) ? version : max)
    : null;

const rawVersion = process.argv[2];
if (process.argv.length > 3) {
    fail(`仅接受一个版本号参数。${usage}`, latest);
}
if (rawVersion === undefined) {
    fail(`未提供版本号。${usage}`, latest);
}
// semver.valid accepts an optional leading "v" and returns the normalized
// version (or null); the tag is always created with the "v" prefix because
// that is what release.yml triggers on.
const version = semver.valid(rawVersion);
if (version === null) {
    fail(`版本号格式非法: ${rawVersion}`, latest);
}
const tag = `v${version}`;
if (tags.has(tag)) {
    fail(`tag ${tag} 已存在。`, latest);
}
if (latest !== null && !semver.gt(version, latest)) {
    fail(`版本号非增量: ${tag} 不大于当前最新 tag v${latest}。`, latest);
}

// The tag points at HEAD, so uncommitted changes would silently miss the
// release; a dirty tree is almost always an accident at this point.
if (runGit(["status", "--porcelain"]).trim() !== "") {
    console.error("✗ 工作区不干净，请先提交或贮藏改动。");
    process.exit(1);
}

console.log("▶ 运行 npm test（含构建与全部门禁）…");
const test = spawnSync("npm", ["test"], { stdio: "inherit" });
if (test.status !== 0) {
    console.error(`✗ npm test 未通过（退出码 ${test.status}），已中止发版。`);
    process.exit(1);
}

runGit(["tag", "-a", tag, "-m", `Release ${tag}`]);
runGit(["push", "origin", tag]);
console.log(`✓ 已推送 tag ${tag}，Release workflow 已触发：门禁通过后会自动创建 GitHub Release 并上传产物。`);
