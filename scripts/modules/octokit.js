// 从旧仓 scripts/modules/octokit.js 裁剪移植（裁剪内容与理由见各项注释）。
// 保留：GITHUB_TOKEN 认证、retry、{owner}/{repo} 地址补全钩子、
// isInGithubActions / isInMasterBranch / isPush / isPullRequest / octokitBaseOptions ——
// commitLint 与 emailmapChecker 所需的全部接口。
// 裁剪：createAppAuth 分支（App 私钥认证，postCommit 专用）、createIssue
// （postCommit 自动开 issue 专用）、debugLog 与 .github/auto_assign.yaml 依赖
// （本仓库无 auto_assign 配置，原文件顶层读取会在本仓库直接崩溃）。
import { endGroup, startGroup } from "@actions/core";
import { createActionAuth } from "@octokit/auth-action";
import { createUnauthenticatedAuth } from "@octokit/auth-unauthenticated";
import { retry } from "@octokit/plugin-retry";
import { Octokit } from "@octokit/rest";
import console from "./console.js";

const isInGithubActions = process.env.GITHUB_ACTIONS === "true";
const isInMasterBranch = process.env.GITHUB_REF === "refs/heads/master";
const isPush = ["push"].includes(process.env.GITHUB_EVENT_NAME);
const isPullRequest = ["pull_request"].includes(process.env.GITHUB_EVENT_NAME);
const octokitBaseOptions = {
    owner: isInGithubActions ? process.env.GITHUB_REPOSITORY_OWNER : null,
    repo: isInGithubActions ? process.env.GITHUB_REPOSITORY.split("/")[1] : null,
};
const workflowLink = isInGithubActions ? `https://github.com/${octokitBaseOptions.owner}/${octokitBaseOptions.repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
let defaultAuthStrategy;
const defaultAuthStrategyParameter = {};
const authParameter = {};
if (!isInGithubActions || !(process.env.GITHUB_TOKEN || process.env.GH_TOKEN)) {
    defaultAuthStrategy = createUnauthenticatedAuth;
    defaultAuthStrategyParameter.reason = isInGithubActions ? "Running in github actions, but no auth env variable found, unable to get any auth." : "Not running in github actions, unable to get any auth.";
} else {
    defaultAuthStrategy = createActionAuth;
}
class OctokitWithRetry extends Octokit.plugin(retry) {
    constructor() {
        super({
            authStrategy: defaultAuthStrategy,
            auth: defaultAuthStrategyParameter,
        });
        // 非常神必，直接给 request 传入 { ...octokitBaseOptions, ...options } 没有任何作用，只能修改地址了
        this.hook.wrap("request", (request, options) => {
            const url = options.url.split("/");
            options.url = url.map((part) => part === "{owner}" ? options.owner || octokitBaseOptions.owner || part : part === "{repo}" ? options.repo || octokitBaseOptions.repo || part : part).join("/");
            return request(options);
        });
    }
}
const octokit = new OctokitWithRetry();
const auth = await octokit.auth(authParameter);
startGroup("octokit initialization:");
console.log("isInGithubActions:", isInGithubActions);
console.log("isInMasterBranch:", isInMasterBranch);
console.log("isPush:", isPush);
console.log("isPullRequest:", isPullRequest);
console.info("workflowLink:", workflowLink);
console.log("octokitBaseOptions:", octokitBaseOptions);
console.log("auth:", auth);
endGroup();
export { isInGithubActions, isInMasterBranch, isPullRequest, isPush, octokit, octokitBaseOptions, OctokitWithRetry, workflowLink };
export default { octokit, isInMasterBranch, octokitBaseOptions, isInGithubActions, isPush, isPullRequest, OctokitWithRetry, workflowLink };
