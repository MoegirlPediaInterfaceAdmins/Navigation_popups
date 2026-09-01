# Navigation popups

[萌娘百科](https://zh.moegirl.org.cn/) [Navigation popups](https://zh.moegirl.org.cn/MediaWiki:Gadget-popups.js) 小工具（`Gadget-popups`）的源码仓库。源码按**维基百科上游的原始文件结构**拆分为 33 个片段存放，构建时按固定顺序拼接为单文件产物 `Gadget-popups.js`，回传至 [MoegirlPediaInterfaceCodes](https://github.com/MoegirlPediaInterfaceAdmins/MoegirlPediaInterfaceCodes) 的 `src/gadgets/Navigation_popups/` 目录，由旧仓库既有流水线完成 lint 与部署。

> [!WARNING]
> **铁律：产物是片段的字节级拼接，不做任何格式化或转译。**
> 请勿对 `src/` 下的片段做重排、重格式化、增删空行等操作——片段之间**没有任何分隔空行**，任何一个字节的变动都会直接进入线上产物。
> 片段是语法不闭合的切片（`_header.js` 打开 `$( () => {`，`run.js` 末尾闭合），单独看会有语法错误，这是正常的；一切检查针对拼接产物进行。

## 来源与授权

- 本小工具源自英文维基百科站内页面 [MediaWiki:Gadget-popups.js](https://en.wikipedia.org/wiki/MediaWiki:Gadget-popups.js)，迁移基线为 [oldid=1322962085](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085)（`build/fragments.json` 的 `source` 字段记录了迁移基线仓库与提交）。上游贡献者名单见该页面编辑历史。
- 萌百版相对上游有大量定制（简繁翻译内置、moment 时间格式化、中文站点适配、Moeskin/vector-2022 容器适配等），**请勿直接复制粘贴上游新版代码覆盖**（产物头注释中亦有此警告）。
- 许可证：[CC BY-SA-4.0](./LICENSE)，与英文维基百科站内文本授权一致。
- `Gadget-popups.css`（源自 [Gadget-navpop.css oldid=825269631](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-navpop.css&oldid=825269631)）**不在本仓库**，仍在 MoegirlPediaInterfaceCodes 中维护。

## 目录结构

```
src/                  # 33 个片段 = 原文件的精确字节切片
  _header.js          # 萌百独有：eslint 指令、@source oldid、警告、"use strict"、$( () => {
  _popupStrings.js    # 萌百独有：237 项 wgULS 简繁翻译表（上游靠外部注入 window.popupStrings）
  main.js … run.js    # 31 个文件沿用上游文件名，顺序与上游一致
build/fragments.json  # 拼接顺序清单（唯一顺序来源，含每个片段的来源行号与备注）
scripts/build.mjs     # 构建：校验 + 字节拼接 → dist/Gadget-popups.js
scripts/migrate.mjs   # 一次性迁移脚本（从旧仓库切片并校验字节一致，留作迁移记录）
scripts/terser-check.mjs  # 用旧仓库同款 terser 参数试压缩产物
dist/                 # 构建产物（不入库）
docs/upstream-sync.md # 上游同步操作指南（执行同步任务时读取）
```

## 构建与质量门禁

```bash
npm ci     # 安装依赖
npm test   # 构建 + 全部门禁：
           #   build           按清单拼接（校验片段集合、换行、无 CR/BOM）
           #   eslint          产物过 @annangela/eslint-config browser 预设（--max-warnings 0）
           #   tsc             产物按 es2020 做语法检查（checkJs 关闭）
           #   terser          用旧仓库部署同款参数试压缩（结果丢弃）
           #   idempotent      连续两次构建字节一致
```

门禁全部作用于**拼接产物**而非片段——产物在本地与将来回传旧仓库后面对的是同一套检查（旧仓库对 `src/` 跑 eslint、tsc、terser）。片段本身被排除在 lint/编译之外。

## 发布与回传

1. 在本仓库完成修改，`npm test` 全绿后合并到 `master`。
2. 打 tag（`v*`）或手动触发 **Release** 工作流：
   - `build-and-gate`：重跑全部门禁，将 `dist/Gadget-popups.js` 与其 sha256 作为 artifact 上传，可随时下载核对；
   - `sync-back`：向旧仓库推分支并开 PR 的回传任务，**当前以 falsy 条件停用**（在 `.github/workflows/release.yml` 的注释中写明了启用步骤：配置对旧仓库单仓最小权限的 fine-grained PAT → 存为 secret `OLD_REPO_TOKEN` → 修改 `if` 条件）。产物无变化时该任务会自动跳过。

回传 PR 合并后，旧仓库既有流水线（postCommit CI → webhook）照常部署。

## 上游同步

同步英文维基百科上游更新时，阅读 [docs/upstream-sync.md](./docs/upstream-sync.md) 并按其流程操作（该文档是同步任务的操作指南，含上游切分规则与萌百版已知差异清单）。

## 贡献流程

1. 修改 `src/` 片段（保持既有代码风格：4 空格缩进、双引号、模板字符串、async/await）；
2. `npm test` 全绿；
3. PR 描述中附上 `dist/Gadget-popups.js` 相对上一版本的实际 diff 摘要；
4. 合并后按需打 tag 触发 Release。
