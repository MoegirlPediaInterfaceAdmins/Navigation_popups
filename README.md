# Navigation popups

[萌娘百科](https://zh.moegirl.org.cn/) [Navigation popups](https://zh.moegirl.org.cn/MediaWiki:Gadget-popups.js) 小工具（`Gadget-popups`）的源码仓库。JS 源码按**维基百科上游的原始文件结构**组织为 33 个 ESM 模块，经 **Rollup + esbuild** 打包为单文件产物 `Gadget-popups.js`；CSS 源码为 SCSS（`src/css/`），经 **sass** 编译为 `Gadget-popups.css`。两份产物回传至 [MoegirlPediaInterfaceCodes](https://github.com/MoegirlPediaInterfaceAdmins/MoegirlPediaInterfaceCodes) 的 `src/gadgets/Navigation_popups/` 目录，由旧仓库既有流水线完成 lint 与部署。

> [!WARNING]
> **产物是编译生成的，请勿手改，也不要把上游新版代码直接复制粘贴进来。**
> 源码（`src/*.ts`）→ `npm run build` → `dist/Gadget-popups.js`，一切修改在源码进行。
> 萌百版相对上游有大量定制（简繁翻译内置、moment 时间格式化、中文站点适配、Moeskin/vector-2022 容器适配等）；上游同步必须按 [docs/upstream-sync.md](./docs/upstream-sync.md) 的流程移植。

## 来源与授权

- 本小工具源自英文维基百科站内页面 [MediaWiki:Gadget-popups.js](https://en.wikipedia.org/wiki/MediaWiki:Gadget-popups.js)，迁移基线为 [oldid=1322962085](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085)（`build/fragments.json` 的 `source` 字段记录了迁移基线仓库与提交）。上游贡献者名单见该页面编辑历史。
- 许可证：[CC BY-SA-4.0](./LICENSE)，与英文维基百科站内文本授权一致。
- `Gadget-popups.css` 源自 [Gadget-navpop.css oldid=825269631](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-navpop.css&oldid=825269631)，已迁入本仓库（`src/css/main.scss` 平铺部分 + `src/css/_darkmode.scss` 暗色适配）。暗色部分（16 组规则 × 3 皮肤变体）为萌百本地专属，上游同步时勿被上游内容覆盖。

## 目录结构

```
src/
├── entry.ts           # 入口：按原片段顺序 import 全部模块（顶层副作用链靠它保序）、jQuery-ready 注册
├── globals.ts         # pg 全局对象、双载入守卫（alreadyLoaded 旗标）、log/errlog（对应上游 main.js）
├── popupStrings.ts    # 237 项 wgULS 简繁翻译表（上游靠外部注入 window.popupStrings）
├── modules/           # 30 个模块沿用上游文件名（一一对应，见 build/fragments.json）
├── types/             # 纯类型：pg.ts（Pg 分域接口）、anchors.ts（HTMLAnchorElement 增强）、
│                      #   globals.d.ts（wgULS/moment/wikEd 等站点全局声明）
└── css/               # main.scss（上游平铺 + 萌百定制）、_darkmode.scss（暗色 16 组 × 三变体 mixin）
build/fragments.json   # 模块/样式 ↔ 上游文件对应清单 + 迁移基线信息（file 字段含 modules/ 前缀）
scripts/build.js       # Rollup API 构建 + 产物断言（无 import/export 残留、模块全量、LF/无 BOM）
scripts/build-css.js   # sass 编译 + 头注释注入 + rgba→rgb 现代语法后处理 + 幂等检查
scripts/esmify.js      # 一次性迁移辅助（import/export 织入），保留作迁移记录
rollup.config.js       # IIFE 输出、treeshake 关闭、banner（eslint 头 + @source oldid + "use strict"）
dist/                  # 构建产物（不入库）
docs/upstream-sync.md  # 上游同步操作指南（执行同步任务时读取）
```

## 模块分层

```
src/entry.ts ────────── 顶层：import 全部模块（顺序 = 原片段拼接顺序）、ready/钩子注册
  │
  ├─ src/modules/ ───── 功能模块层（actions/navlinks/navpopup/previewmaker/… 30 个）
  │    互相 import、运行期互调是上游结构的常态；rollup 对循环依赖放行（见下）
  │
  ├─ src/popupStrings.ts ── 萌百独有 i18n 表（仅依赖 globals）
  │
  └─ 基础层：src/globals.ts（pg、双载入守卫、log/errlog）
       modules/ 内的 tools/titles/strings/options/namespaces 等被广泛依赖的工具模块
```

分层不是硬约束——`rollup.config.js` 的 `onwarn` 只放行 `CIRCULAR_DEPENDENCY`（跨模块调用全部发生在运行期，此时所有模块体已求值完毕），其余警告一律 fatal。但**新代码应尽量向下依赖、避免加剧环**；顶层副作用顺序约束见下节。

## 构建与质量门禁

```bash
npm ci     # 安装依赖（husky 钩子自动安装；CI/production 下静默跳过）
npm test   # 全部门禁：
           #   build      Rollup 打包 33 模块（treeshake 关闭，语句全保留；断言模块全量、
           #              产物无 import/export 残留、LF/无 BOM、末尾换行）
           #   build:css  sass 编译 src/css → dist/Gadget-popups.css（头注释注入、
           #              rgba→rgb 现代语法与 @media 空行后处理，保证与旧仓 stylelint 兼容）
           #   eslint     eslint . --max-warnings 0：src 严集（@annangela/eslint-config
           #              typescript：strict-type-checked + stylistic-type-checked，0 违规）
           #              + 产物（browser 预设）+ 脚本/钩子/配置（node 预设）；
           #              另禁用 Boolean()/Number() 构造函数（用 !! / 一元 +）
           #   stylelint  产物 CSS 过 standard + use-baseline（警告计失败，与旧仓同规集）
           #   tsc        单 program 双职责：src 全 strict 类型检查（0 错误）+ 产物语法检查
           #   terser     两级：①acorn ecmaVersion 2020 parse 产物（拦 es2021+ 语法泄漏——
           #              tsc emit 会静默降级、terser 解析器放行现代语法，二者均不拦，
           #              acorn 是精确边界）；②复刻旧仓部署顺序 tsc es2020 emit →
           #              对 emit 产物按部署同款 terser 参数试压缩（结果均丢弃）
           #   idempotent 连续两次构建字节一致，且与磁盘 dist 一致（JS 与 CSS 各一道）
           #   postcss    按旧仓同款 .postcssrc.yaml 插件链处理产物，0 警告门禁
           #   mailmap    提交身份须在 .mailmap（bot 豁免逻辑与旧仓一致）
```

模块全量断言：`build/fragments.json` 清单中的每个模块必须出现在 bundle 依赖图里（漏 import 会在构建时报错）。

提交信息与 PR 标题受 commitlint 约束（Conventional Commits，type 额外放行 `npm`/`gha`——dependabot 前缀）：本地 husky 钩子（commit-msg / pre-commit / post-merge / post-rewrite）+ CI 侧 `commit lint` 工作流（push 提交 + PR 标题）双层把关。

### 顶层副作用顺序

entry.ts 的 import 顺序 = 原单文件片段顺序。Rollup 在此基础上按依赖拓扑微调模块位置，已验证的关键顺序约束（`pg` 字面量最先；`domdrag` 填充 `pg.structures.original` 先于 `structures` 的 `copyStructure`；entry 的 ready/钩子注册最后）在产物中保持成立。改动 entry import 顺序或增删带顶层副作用的代码时，必须重新核对这些约束。

## 类型与 lint 纪律

全部 33 个模块都在 strict tsc + 严集 eslint 之下，**当前基线为 0 类型错误 / 0 lint 违规**，无 `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error`。保持这个基线的规则：

- 上游运行时不变量（“此处调用方保证非空/必为某形状”）用 `tools.ts` 的 `assume<T>()` 表达——恒等函数、运行时零开销。不要用 `!`（被 `no-non-null-assertion` 禁），也不要用会被 `non-nullable-type-assertion-style` 改写的裸 `as`。
- 与上游行为有实质冲突的规则点，用**单行 scoped `eslint-disable-… -- 理由`** 承接（现状 38 处 next-line + 1 处文件级：`shortcutkeys.ts` 整文件构建在 legacy keypress/`window.event` API 之上）。理由必须写明上游行为依据，禁止无理由 disable。
- 两处仅有的全局豁免：src 的 `no-use-before-define` 与 `camelcase` 关闭（`eslint.config.js`，上游自底向上的辅助函数排序与标识符 1:1 保留）。

## 发布与回传

1. 修改源码，`npm test` 全绿后合并到 `master`（CI 对 master push 与 PR 跑同一套门禁）。
2. 打 tag（`v*`）或手动触发 **Release** 工作流：
   - `build-and-gate`：重跑全部门禁，将 `dist/Gadget-popups.js`、`dist/Gadget-popups.css` 与 sha256 清单作为 artifact 上传；
   - `sync-back`：向旧仓库推分支并开 PR 的回传任务（js+css 两文件），**当前以 falsy 条件停用**（`.github/workflows/release.yml` 注释写明启用步骤：fine-grained PAT → secret `OLD_REPO_TOKEN` → 改 `if` 条件）。产物无变化时自动跳过。回传提交身份固定为 `github-actions[bot]`（旧仓 mailmap 门禁的 bot 豁免要求）。

### 上线后人工冒烟清单（每次产物变更后）

鉴于功能一致性验证采用静态门禁档位（仅构建期检查，无运行时对照），产物变更合入旧仓库部署后，请在站点上人工过一遍核心路径：

- [ ] **hover 弹窗**：悬停普通条目链/用户链/讨论页链/红链/消歧义链，弹窗正常出现、移出后消失、可拖拽；
- [ ] **用户预览链接组**：编辑计数、arin 等链接行为正常（`links.ts` 含 zh 站点定制链接）；
- [ ] **diff 预览**：悬停 diff 链接出双栏 diff；历史页悬停出历史预览；图片/分类等 API 预览正常；
- [ ] **快捷键**：弹出后按字母跳转锚点、Esc 关闭（legacy keypress 路径）；
- [ ] **双载入守卫**：重复导入脚本不二次初始化（控制台无重复 setup 日志、无行为异常）；
- [ ] **动态内容**：echo 通知、VisualEditor/wikEd 场景下预览刷新正常；
- [ ] **旧仓库 CI**：回传 PR 的 lint 通过。

## 上游同步

同步英文维基百科上游更新时，阅读 [docs/upstream-sync.md](./docs/upstream-sync.md) 并按其流程操作（该文档是同步任务的操作指南，含上游切分规则、模块对应表与 TS 移植要求）。

## 工具链与旧仓同步

lint/commit/格式化工具链复制自 [MoegirlPediaInterfaceCodes](https://github.com/MoegirlPediaInterfaceAdmins/MoegirlPediaInterfaceCodes)（共享基座为 npm 包 `@annangela/eslint-config`）。与旧仓的配置一致性由 **config-sync** 机制维护：

- 清单 `build/config-sync-manifest.json`：每项登记旧仓路径、策略（`byte-equal` 逐字节一致 / `adapted` 有意偏差+注记）与 `lastSyncedHash` 锚点；
- 工作流 `.github/workflows/config-sync.yaml`：每周二 07:30（CST）+ 手动，检测漂移自动开 PR——byte-equal 项直接覆盖；adapted 项存档旧仓新版至 `docs/config-sync/incoming/` 并附适配指引，须人工完成适配后合并；同文件已有 open PR 时去重评论；
- 开 PR 用 PAT（secret `CONFIG_SYNC_TOKEN`：fine-grained，仅本仓库 Contents RW + Pull requests RW）——`GITHUB_TOKEN` 创建的 PR 不触发 CI/commitLint。secret 未配置时工作流会红并提示。

### 新旧仓门禁对照

| 本仓门禁 | 对应旧仓检查 |
|---|---|
| src TS 严集 eslint（strict-type-checked） | —（超出旧仓，加强项） |
| dist 产物 browser 预设 eslint `--max-warnings 0` | `test:eslint`（对回传文件） |
| scripts/ + .husky/ + 根配置 node 预设 eslint | `lint:scripts` |
| dist CSS stylelint（standard + use-baseline，警告计败） | `test:stylelint` |
| dist CSS postcss 0 警告（同款 .postcssrc.yaml 插件链） | `scripts/postcss` 检查 |
| tsc `--noEmit`（strict，src） | —（旧仓不做，加强项） |
| acorn ecma2020 parse 产物（拦 es2021+ 泄漏） | —（新机制，守卫 es2020 目标） |
| tsc es2020 **emit** 编译 dist → 对 emit 产物 terser 试压缩 | 部署编译链（tsc es2020 → terser） |
| commitlint：提交信息 + PR 标题（npm/gha 放行） | `commitLint.yaml` |
| mailmap 检查（本地 + CI，bot 豁免） | `test:mailmap` |
| CodeQL（actions + js/ts，paths-ignore dist） | `CodeQL.yaml`（旧仓曾整目录排除本 gadget，本仓正面分析——独立仓库的安全收益） |
| dependabot（gha + npm，每日 07:30 分组） | `dependabot.yaml`（逐字节一致） |
| config-sync 漂移检测 | —（新机制） |

明确不复制旧仓的：`v8r` + gadget JSON Schema、postCommit 全套生成器、`selectRegistry` 测速装依赖、`auto_assign`。`.mailmap` 为种子拷贝，两仓各自演进，不机械同步。

## 贡献流程

1. 修改 `src/*.ts`（保持既有代码风格：4 空格缩进、双引号、模板字符串、async/await；新代码必须全类型，见「类型与 lint 纪律」）；
2. `npm test` 全绿；
3. PR 描述附上产物相对上一版的功能性变更摘要；
4. 合并后按需打 tag 触发 Release，并按冒烟清单人工验证。
