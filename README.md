# Navigation popups

[萌娘百科](https://zh.moegirl.org.cn/) [Navigation popups](https://zh.moegirl.org.cn/MediaWiki:Gadget-popups.js) 小工具（`Gadget-popups`）的 TypeScript 源码仓库。源码按**维基百科上游的原始文件结构**组织为 33 个 ESM 模块，经 **Rollup + esbuild** 打包为单文件产物 `Gadget-popups.js`，回传至 [MoegirlPediaInterfaceCodes](https://github.com/MoegirlPediaInterfaceAdmins/MoegirlPediaInterfaceCodes) 的 `src/gadgets/Navigation_popups/` 目录，由旧仓库既有流水线完成 lint 与部署。

> [!WARNING]
> **产物是编译生成的，请勿手改，也不要把上游新版代码直接复制粘贴进来。**
> 源码（`src/*.ts`）→ `npm run build` → `dist/Gadget-popups.js`，一切修改在源码进行。
> 萌百版相对上游有大量定制（简繁翻译内置、moment 时间格式化、中文站点适配、Moeskin/vector-2022 容器适配等）；上游同步必须按 [docs/upstream-sync.md](./docs/upstream-sync.md) 的流程移植。

## 来源与授权

- 本小工具源自英文维基百科站内页面 [MediaWiki:Gadget-popups.js](https://en.wikipedia.org/wiki/MediaWiki:Gadget-popups.js)，迁移基线为 [oldid=1322962085](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085)（`build/fragments.json` 的 `source` 字段记录了迁移基线仓库与提交）。上游贡献者名单见该页面编辑历史。
- 许可证：[CC BY-SA-4.0](./LICENSE)，与英文维基百科站内文本授权一致。
- `Gadget-popups.css`（源自 [Gadget-navpop.css oldid=825269631](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-navpop.css&oldid=825269631)）**不在本仓库**，仍在 MoegirlPediaInterfaceCodes 中维护。

## 目录结构

```
src/
├── entry.ts           # 入口：按原片段顺序 import 全部模块（顶层副作用链靠它保序）、双载入门闸、jQuery-ready 注册
├── globals.ts         # pg 全局对象、双载入守卫（alreadyLoaded 旗标）、log/errlog（对应上游 main.js）
├── popupStrings.ts    # 237 项 wgULS 简繁翻译表（上游靠外部注入 window.popupStrings）
├── actions.ts … run.ts  # 30 个模块沿用上游文件名（一一对应，见 build/fragments.json）
└── types/             # pg 接口与站点全局（wgULS/moment 等）环境声明
build/fragments.json   # 模块 ↔ 上游文件对应清单 + 迁移基线信息
scripts/build.mjs      # Rollup API 构建 + 产物断言（无 import/export 残留、模块全量、LF/无 BOM）
scripts/esmify.mjs     # 一次性迁移辅助（import/export 织入），保留作迁移记录
rollup.config.mjs      # IIFE 输出、treeshake 关闭、banner（eslint 头 + @source oldid + "use strict"）
dist/                  # 构建产物（不入库）
docs/upstream-sync.md  # 上游同步操作指南（执行同步任务时读取）
```

## 构建与质量门禁

```bash
npm ci     # 安装依赖
npm test   # 全部门禁：
           #   build      Rollup 打包 33 模块（treeshake 关闭，语句全保留）
           #   eslint     src 严集（@annangela/eslint-config typescript：strict-type-checked
           #              + stylistic-type-checked）+ 产物（browser 预设）+ 脚本（node 预设）
           #   tsc        src 全 strict 类型检查 + 产物语法检查（同一 program）
           #   terser     用旧仓库部署同款参数试压缩（结果丢弃）
           #   idempotent 连续两次构建字节一致
```

模块全量断言：`build/fragments.json` 清单中的每个模块必须出现在 bundle 依赖图里（漏 import 会在构建时报错）。

### 顶层副作用顺序

entry.ts 的 import 顺序 = 原单文件片段顺序。Rollup 在此基础上按依赖拓扑微调模块位置，已验证的关键顺序约束（`pg` 字面量最先；`domdrag` 填充 `pg.structures.original` 先于 `structures` 的 `copyStructure`；entry 的 ready/钩子注册最后）在产物中保持成立。改动 entry import 顺序或增删带顶层副作用的代码时，必须重新核对这些约束。

## 类型化状态与债务清单

- **已真类型化**：`globals.ts`、`entry.ts`、`src/types/**`（`Pg` 分域接口起步，域暂为宽松 record）。
- **承接债务**：其余 30 个 legacy 模块带 `// @ts-nocheck -- …` 与 `/* eslint-disable -- … */` 头（迁移时 strict tsc/严集 eslint 存量约 1900 项类型错误、主要是隐式 any 参数与 `pg` 动态属性访问）。**解除流程**：逐文件移除两行承接头 → 按报错补类型（优先收紧 `types/pg.ts` 的对应域，禁止新增裸 `any`）→ `npm test` 全绿 → 独立 PR。新代码一律全类型，不允许新增承接头。

## 发布与回传

1. 修改源码，`npm test` 全绿后合并到 `master`。
2. 打 tag（`v*`）或手动触发 **Release** 工作流：
   - `build-and-gate`：重跑全部门禁，将 `dist/Gadget-popups.js` 与其 sha256 作为 artifact 上传；
   - `sync-back`：向旧仓库推分支并开 PR 的回传任务，**当前以 falsy 条件停用**（`.github/workflows/release.yml` 注释写明启用步骤：fine-grained PAT → secret `OLD_REPO_TOKEN` → 改 `if` 条件）。产物无变化时自动跳过。

### 上线后人工冒烟清单（每次产物变更后）

鉴于功能一致性验证采用静态门禁档位，产物变更合入旧仓库后请在站点过一遍：hover 弹窗出现与消失、条目/用户/编辑计数链接组、diff 预览与历史预览、快捷键呼出、双载入守卫（重复导入不重复初始化）、动态内容（echo 通知/预览刷新）场景。

## 上游同步

同步英文维基百科上游更新时，阅读 [docs/upstream-sync.md](./docs/upstream-sync.md) 并按其流程操作（该文档是同步任务的操作指南，含上游切分规则、模块对应表与 TS 移植要求）。

## 贡献流程

1. 修改 `src/*.ts`（保持既有代码风格：4 空格缩进、双引号、模板字符串、async/await；新代码必须全类型）；
2. `npm test` 全绿；
3. PR 描述附上产物相对上一版的功能性变更摘要；
4. 合并后按需打 tag 触发 Release。
