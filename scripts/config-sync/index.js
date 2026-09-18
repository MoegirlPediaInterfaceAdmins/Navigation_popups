// 配置漂移检测与同步（对应 .github/workflows/config-sync.yaml）。
// 流程（build/config-sync-manifest.json 为唯一清单）：
//   1. 逐项拉旧仓 master 文件，计算 git blob hash；
//   2. oldHash == lastSyncedHash → 无漂移；否则按策略处理：
//      - byte-equal：旧仓新内容直接覆盖本仓副本；
//      - adapted：旧仓新版本存档至 docs/config-sync/incoming/，更新 manifest hash，
//        PR 中附偏差注记与适配指引，适配必须人工完成后合并；
//   3. 本地运行默认 dry-run（只报告）；CI（GITHUB_ACTIONS=true）或 --apply 时
//      为每个漂移文件开 config-sync/<slug> 分支与 PR；同分支已有 open PR 时
//      只在既有 PR 追加评论（去重）。
// 开 PR 必须用 PAT（CONFIG_SYNC_TOKEN）：GITHUB_TOKEN 创建的 PR 不触发其他
// workflow（CI/commitLint 不会跑）。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import octokit, { isInGithubActions } from "../modules/octokit.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = path.join(root, "build", "config-sync-manifest.json");
const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
const apply = process.argv.includes("--apply") || isInGithubActions;
const execFileAsync = promisify(execFile);

const blobHash = (content) => crypto.createHash("sha1").update(`blob ${Buffer.byteLength(content)}\0${content}`).digest("hex");

const fetchOld = async (repo, branch, file) => {
    const response = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${file}`, { headers: { "cache-control": "no-cache" } });
    if (!response.ok) {
        throw new Error(`fetch ${repo}@${branch}:${file} failed: ${response.status}`);
    }
    return await response.text();
};

const slugify = (filePath) => filePath.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const drifts = [];
for (const item of manifest.items) {
    const oldContent = await fetchOld(manifest.oldRepository, manifest.oldBranch, item.oldPath);
    const oldHash = blobHash(oldContent);
    if (oldHash === item.lastSyncedHash) {
        continue;
    }
    const localContent = await fs.promises.readFile(path.join(root, item.newPath), "utf8");
    // 本仓副本若已人工对齐旧仓新版本（byte-equal 已一致 / adapted 已按新版适配），
    // 只落后 manifest 锚点 —— 视为已完成同步，仅登记新 hash。
    if (item.strategy === "byte-equal" && blobHash(localContent) === oldHash) {
        item.lastSyncedHash = oldHash;
        continue;
    }
    drifts.push({ item, oldContent, oldHash, localContent });
}

if (drifts.length === 0) {
    console.info("No drift detected against", manifest.oldRepository);
    process.exit(0);
}

if (!apply) {
    console.info(`Dry-run: ${drifts.length} drifted item(s):`);
    for (const { item, oldHash } of drifts) {
        console.info(`  [${item.strategy}] ${item.oldPath}: ${item.lastSyncedHash.slice(0, 8)} -> ${oldHash.slice(0, 8)}`);
    }
    console.info("Re-run with --apply (or in CI) to open sync PRs.");
    process.exit(0);
}

for (const { item, oldContent, oldHash } of drifts) {
    const branch = `config-sync/${slugify(item.oldPath)}`;
    // 去重：同分支已有 open PR 时不重复开，改为评论最新漂移。
    const openPRs = await octokit.rest.pulls.list({
        state: "open",
        head: `${process.env.GITHUB_REPOSITORY?.split("/")[0] ?? ""}:${branch}`,
        per_page: 1,
    });
    const existing = openPRs.data[0];
    if (existing) {
        await octokit.rest.issues.createComment({
            issue_number: existing.number,
            body: `旧仓 \`${item.oldPath}\` 又有新变化（blob \`${item.lastSyncedHash.slice(0, 8)}\` → \`${oldHash.slice(0, 8)}\`），请以本评论时间为准重新执行适配。\n\n最新旧仓版本：<https://github.com/${manifest.oldRepository}/blob/${manifest.oldBranch}/${item.oldPath}>`,
        });
        console.info(`Commented on existing PR #${existing.number} for ${item.oldPath}`);
        continue;
    }

    await execFileAsync("git", ["checkout", "-b", branch, "origin/master"], { cwd: root });
    let commitMessage;
    let prBody;
    if (item.strategy === "byte-equal") {
        await fs.promises.writeFile(path.join(root, item.newPath), oldContent);
        commitMessage = `chore(config-sync): sync ${item.oldPath} from ${manifest.oldRepository}@${oldHash.slice(0, 8)}`;
        prBody = `旧仓 \`${item.oldPath}\` 有更新（byte-equal 项，直接覆盖）。\n\n- 旧仓侧 diff：<https://github.com/${manifest.oldRepository}/compare/${item.lastSyncedHash.slice(0, 8)}…${oldHash.slice(0, 8)}>\n- 本 PR 由 config-sync 工作流自动生成，覆盖后应全量通过门禁即可合并。`;
    } else {
        const incoming = path.join(root, "docs", "config-sync", "incoming", item.oldPath);
        await fs.promises.mkdir(path.dirname(incoming), { recursive: true });
        await fs.promises.writeFile(incoming, oldContent);
        const manifestItems = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
        manifestItems.items.find((entry) => entry.oldPath === item.oldPath).lastSyncedHash = oldHash;
        await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifestItems, null, 4)}\n`);
        commitMessage = `docs(config-sync): 待适配 ${item.oldPath}（旧仓 ${item.lastSyncedHash.slice(0, 8)}→${oldHash.slice(0, 8)}）`;
        prBody = [
            `旧仓 \`${item.oldPath}\` 有更新，该项为 **adapted**（本仓存在有意偏差），需要人工适配。`,
            "",
            "### 已登记的偏差注记",
            item.note,
            "",
            "### 旧仓本次变更",
            `- 完整文件（新版）：<https://github.com/${manifest.oldRepository}/blob/${manifest.oldBranch}/${item.oldPath}>`,
            `- 已存档至 \`docs/config-sync/incoming/${item.oldPath}\``,
            "",
            "### 适配指引",
            "1. 对照 incoming 存档与本仓副本，把旧仓本次变更中**适用于本仓**的部分移植过来（保留本仓既有偏差）；",
            "2. 更新 manifest 中该项的 note（若偏差内容因此变化）。",
            "",
            "### 合并前检查单",
            "- [ ] 适配完成，`npm test` 全绿",
            `- [ ] 删除 \`docs/config-sync/incoming/${item.oldPath}\` 存档`,
            "- [ ] 确认 manifest `lastSyncedHash` 已指向旧仓新版本",
        ].join("\n");
    }
    await execFileAsync("git", ["add", item.newPath, manifestPath, "docs/config-sync/incoming"], { cwd: root });
    await execFileAsync("git", ["commit", "-m", commitMessage], { cwd: root });
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const pushUrl = token ? `https://x-access-token:${token}@github.com/${process.env.GITHUB_REPOSITORY}.git` : "origin";
    await execFileAsync("git", ["push", pushUrl, `HEAD:refs/heads/${branch}`], { cwd: root });
    const { data: pr } = await octokit.rest.pulls.create({
        title: commitMessage,
        head: branch,
        base: "master",
        body: prBody,
    });
    console.info(`Opened PR #${pr.number} for ${item.oldPath} (${item.strategy})`);
}
