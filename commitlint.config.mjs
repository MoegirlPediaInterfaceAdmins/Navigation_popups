// 本仓库存在两类非标准但合法的提交前缀，严格套用 config-conventional 会误报：
// - `npm` / `gha`：dependabot 的 commit-message.prefix（见 .github/dependabot.yaml）。
// （旧仓另有 `auto`（postCommit CI 自动提交前缀），本仓库无 postCommit，不放行。）
// 这些前缀在下方 `type-enum` 中显式放行即可；不要用 `ignores` 整条跳过，
// 否则 `npm: ` 这类空 subject 的畸形提交也会被静默放过。
export default {
    "extends": ["@commitlint/config-conventional"],
    rules: {
        "type-enum": [2, "always", [
            "build",
            "chore",
            "ci",
            "docs",
            "feat",
            "fix",
            "perf",
            "refactor",
            "revert",
            "style",
            "test",
            "npm",
            "gha",
        ]],
        // 提交标题习惯携带 PR 编号，放宽行宽限制（与旧仓一致）。
        "header-max-length": [2, "always", 140],
        "body-max-line-length": [0],
        "footer-max-line-length": [0],
        // 中文描述无法用 case 规则约束。
        "subject-case": [0],
    },
};
