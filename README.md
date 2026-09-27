# Navigation popups

[萌娘百科](https://zh.moegirl.org.cn/) [Navigation popups](https://zh.moegirl.org.cn/MediaWiki:Gadget-popups.js) 小工具（`Gadget-popups`）的源码仓库。JS 源码为 TypeScript（`src/`，按功能域分层），经 **Rollup + esbuild** 打包为单文件产物 `dist/Gadget-popups.js`；CSS 源码为 SCSS（`src/css/`），经 **sass** 编译为 `dist/Gadget-popups.css`。两份产物在发版时作为 GitHub Release 的 assets 发布，向 [MoegirlPediaInterfaceCodes](https://github.com/MoegirlPediaInterfaceAdmins/MoegirlPediaInterfaceCodes) 的同步由人工从 Release assets 获取完成。

> [!WARNING]
> **产物是编译生成的，请勿手改，也不要把上游新版代码直接复制粘贴进来。**
> 源码（`src/**/*.ts`）→ `npm test` → `dist/`，一切修改在源码进行。
> 萌百版相对上游有大量定制（简繁翻译内置、moment 时间格式化、中文站点适配、Moeskin/vector-2022 容器适配、暗色三变体等）；上游同步必须对照 [docs/functional-spec.md](./docs/functional-spec.md)。

## 行为基准

- **功能基准 = legacy 萌百现行单文件版**：`MoegirlPediaInterfaceCodes` 的 `src/gadgets/Navigation_popups/Gadget-popups.js` @ commit `5adc9438`（6529 行；上游基线 enwiki [oldid=1322962085](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085)）。验收原则是**功能一致**，不追求逐字节一致。
- legacy 的 TS 存档（已退役的移植版拆分）保留在 `.zcode/legacy-src/`（不入库），作为行为对照与考古入口。
- **已知偏差登记在 [docs/semantic-notes.md](./docs/semantic-notes.md)**：新增有意差异必须在该文件追加条目（差异描述 / legacy 行为 / 重写版行为 / 用户可见性 / 论据）。
- 功能清单（应然基准）见 [docs/functional-spec.md](./docs/functional-spec.md)；发版前人工验证按 [docs/smoke-test.md](./docs/smoke-test.md)。

> [!IMPORTANT]
> **实现状态**：推倒重写已全部完成（阶段 1–5）——core/title/net/api/preview/navlinks/actions
> 全部功能域 + boot/entry 装配（含 `mw.hook` 动态内容重扫与 `window.pg` 四域兼容面）均已落地，
> 全量测试与构建门禁全绿、coverage 四项 100%。验收以 `npm test` + 真站点冒烟
> （[docs/smoke-test.md](./docs/smoke-test.md)）为准；已知语义差异见
> [docs/semantic-notes.md](./docs/semantic-notes.md)。

## 来源与授权

- 本小工具源自英文维基百科站内页面 [MediaWiki:Gadget-popups.js](https://en.wikipedia.org/wiki/MediaWiki:Gadget-popups.js)，迁移基线为 [oldid=1322962085](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085)。上游贡献者名单见该页面编辑历史。
- 许可证：[CC BY-SA-4.0](./LICENSE)，与英文维基百科站内文本授权一致。
- `Gadget-popups.css` 源自 [Gadget-navpop.css oldid=825269631](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-navpop.css&oldid=825269631)，已迁入本仓库（`src/css/main.scss` 平铺部分 + `src/css/_darkmode.scss` 暗色适配）。暗色部分（16 组规则 × 3 皮肤变体）与 `.navpopup` 的 line-height、`.popupPreview td` 的 word-break 均为萌百本地专属，上游同步时勿被上游内容覆盖。

## 目录结构

```text
src/
├── entry.ts            # 入口：双载入守卫、jQuery-ready/load 分支 → boot()（唯一在模块顶层触碰 window/DOM 的模块）
├── boot.ts             # 初始化编排（legacy run.ts + init.ts 的 setupPopups）：站点查询 → 各域 setup → setupTooltips → tracker
├── state.ts            # 类型化状态容器兼 window.pg 兼容面（fn/option/string/wiki 四域）
├── core/               # 弹窗本体与通用件：popup(Navpopup 类)、structures(7 结构 + 槽注册表)、htmlout(槽写入/轮询)、
│                       #   events(链接绑定与悬停隐藏流)、drag、mousetracker、selection(选区弹窗)、
│                       #   shortcutkeys、options(98 项默认值)、strings(i18n 查表 + tprintf)、tools、log
├── title/              # title(Title/Stringwrapper、URL 与 wikitext 互转、isPopupLink)、namespaces(ns/interwiki/重定向正则)
├── net/                # downloader(裸 XHR + abort + 中止全部)、cache(URL 级缓存 + fakeDownload)
├── api/                # siteinfo(站点元数据/基址/正则装配 + mw.Api 单例)、queries(七类 API 预览 + 用户/commons 等生成器)
├── preview/            # pipeline(预览管线/重定向跟随/anchorize)、dispatch(分派 + 脚注)、previewmaker(清洗与截断)、
│                       #   insta(wiki2html 引擎)、pageinfo(8 统计过滤器)、diff(算法)、diffpreview(diff 预览渲染)、
│                       #   images(图片与文件页)、dab(消歧与红链)
├── navlinks/           # navlinks(DSL 解析 + 60 个 navlink + 7 结构槽填充器)、links(链接构造器与 pg.fn.* 实现)
├── actions/            # autoedit(编辑页 URL 协议引擎)
├── i18n/               # popupStrings(242 键萌百/繁简翻译表)
├── types/              # globals.d.ts(站点全局与 DOM 增广声明)
└── css/                # main.scss(上游平铺 + 萌百定制)、_darkmode.scss(16 组 × 三变体 mixin)
tests/
├── helpers/            # mockMw / mockXHR / wikiFixtures / setup（真 jQuery + wgULS 直通）
├── unit/               # 按 src 域镜像：core/ title/ net/ api/ preview/ navlinks/ actions/ + entry/boot/i18n
└── integration/        # hover 全流、article-preview（mock API 驱动的端到端预览）
scripts/                # build.js / build-css.js / terser-check.js / postcss / emailmapChecker / commitLint / config-sync / esmify(历史)
build/                  # config-sync-manifest.json（与旧仓的配置同步清单）
docs/                   # functional-spec.md（功能基准）、semantic-notes.md（偏差登记）、smoke-test.md（人工冒烟）
dist/                   # 构建产物（不入库）
```

## 架构约束

1. **模块顶层零副作用**——模块顶层只做定义（含纯数据表构建与模块内注册表写入：`structures.ts` 的 7 种结构定义、`navlinks.ts`/`images.ts` 向槽填充器注册表 `registerSlotFiller` 的注册，都只写模块内状态）；**只有 `entry.ts` 在模块顶层触碰外部世界**（守卫 + `window.pg = state` + jQuery-ready 注册）。一切初始化经 ready/load 回调调用 `boot()` 显式展开。这是可测性基础（测试可直接 import 任意模块），也是与 legacy「全部代码在 DOM ready 回调内求值」等价性的来源。
2. **循环依赖白名单**——`rollup.config.js` 的 `onwarn` 对 `CIRCULAR_DEPENDENCY` 做白名单判定：环中模块全部落在 `KNOWN_CYCLE_MODULES`（options/events/selection/shortcutkeys/queries/pipeline/images/pageinfo/dispatch/dab/diffpreview/links 十二个）内则放行，**任一模块越出白名单即抛错**；其余 rollup 警告一律 fatal。续期依据是「模块顶层零副作用」约束（顶层从不求值跨模块绑定），故函数级环在运行期安全，且 preview/event 各域本就相互递归（上游原始设计）；把环全部拆掉需要在五个已冻结的域之间引入注册缝、无运行期收益。跨域解耦仍优先走显式注册缝（`registerAbortAll`/`registerSetupPopups`/`registerModifyWatchlist`/`registerPositionChecker`/`registerTooltipScanner`/`registerSlotFiller`），**新代码不应扩大环**。
3. **状态收敛**——legacy 的 `pg` 动态域拆为各域模块级单例（`eventsState`/`optionStore`/`nsState`/`siteState`/`userState`），`window.pg` 只保留对外兼容四域（`fn`/`option`/`string`/`wiki`，函数值与模块导出引用相等）。
4. **保持 legacy 行为语义**：DOM0 事件属性接管、`setPopupHTML` 轮询重试、`javascript:` URL 菜单项、XHR 直连下载器等按原行为实现（功能一致优先，不为现代化改变行为）；legacy 的怪癖按注释「照搬勿修」保留。
5. **不可测防御按「不过度防御」删除**，不写 coverage ignore；legacy 结构性不可达的防御分支经评审后保留的，逐条配 `// istanbul ignore …` 与理由（现状 25 处，清单见 `docs/semantic-notes.md` §B）。

## 开发与质量门禁

```bash
npm ci     # 安装依赖（husky 钩子自动安装；CI/production 下静默跳过）
npm test   # 全部门禁，按序：
           #   build           rollup 打包 src/entry.ts（es2020、treeshake、banner；断言 banner/无 CR/无 BOM/
           #                   无 import-export 残留/末尾换行），并对产物跑本仓 eslint（fix 后免 fix 复检）
           #   build:css       sass 编译 src/css → dist/Gadget-popups.css（头注释注入、rgba→rgb 现代语法与
           #                   @media 空行后处理，保证与旧仓 stylelint 兼容）
           #   test:eslint     eslint . --max-warnings 0：src 严集（@annangela/eslint-config typescript：
           #                   strict-type-checked + stylistic-type-checked）+ 产物（browser 预设）+
           #                   脚本/钩子/配置（node 预设）；禁用 Boolean()/Number() 构造函数（用 !! / 一元 +）
           #   test:stylelint  产物 CSS 过 standard + use-baseline（警告计失败，与旧仓同规集）
           #   test:tsc        tsconfig.json 单 program：src 全 strict 类型检查 + 产物语法检查
           #   test:unit       vitest run --coverage（jsdom + 真 jQuery；四项 100% 阈值常开，不达标即失败）
           #   test:terser     ①acorn ecmaVersion 2020 parse 产物（拦 es2021+ 语法泄漏——tsc emit 会静默降级、
           #                   terser 解析器放行现代语法，二者均不拦，acorn 是精确边界）；
           #                   ②复刻旧仓部署顺序：tsc es2020 emit → 对 emit 产物按部署同款 terser 参数试压缩（结果丢弃）
           #   test:idempotent 连续两次构建字节一致，且与磁盘 dist 一致
           #   test:css        CSS 构建幂等检查
           #   test:postcss    按旧仓同款 .postcssrc.yaml 插件链处理产物，0 警告
           #   test:mailmap    提交身份须在 .mailmap（bot 豁免逻辑与旧仓一致）
```

测试事实：

- **vitest + jsdom + 真 jQuery**（非 mock，保证 `trigger("focus")` 等行为一致）。`setupFiles`（`tests/helpers/setup.ts`）先于任何 src 模块 import 装好 `wgULS`（简体直通）与 `$`；`moment` 等其余站点全局由各测试文件经 `vi.stubGlobal` 注入 **node_modules 里的真 moment**（`unstubGlobals: true`，测试文件间自动卸载）。`mw` 由 `tests/helpers/mockMw.ts` 的可编程工厂提供。
- **coverage 四项（lines/branches/functions/statements）100% 阈值常开**（`vitest.config.ts`，istanbul provider——v8 对 `typeof` 收窄等形态会产生永不计数的合成边）。当前用例数 **1370**（随阶段收尾持续增加）；不达标时 `npm test` 直接失败。
- 断言写法：上游运行时不变量用 `core/tools.ts` 的 `assume<T>()`（恒等函数、运行时零开销），不用 `!`（被 `no-non-null-assertion` 禁）；与上游行为冲突的规则点用**单行 scoped `eslint-disable-… -- 理由`**（本文修订时 28 处 next-line + 1 处文件级：`core/shortcutkeys.ts` 整文件构建在 legacy `keypress`/`keyCode`/`window.event` API 之上）；理由必须写明上游行为依据，禁止无理由 disable。数量随代码演进，以 `grep -rn "eslint-disable" src/` 为准。
- 仅有的全局豁免：src 的 `no-use-before-define` 与 `camelcase`（上游自底向上的辅助函数排序与 wiki/DOM 契约标识符 1:1 保留）。**零 `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error`**。
- 提交信息与 PR 标题受 commitlint 约束（Conventional Commits，type 额外放行 `npm`/`gha`）——本地 husky（commit-msg / pre-commit / post-merge / post-rewrite）+ CI 侧 `commitLint.yaml`（push 提交 + PR 标题）双层把关。

## 发布

1. 修改源码，`npm test` 全绿后合并到 `master`（CI 对 master push 与 PR 跑同一套门禁）。
2. 打 tag（`v*`）触发 **Release** 工作流（手动触发只跑构建门禁与 artifact 上传，不发 release）：
   - `build-and-gate`：重跑全部门禁，将 `dist/Gadget-popups.js`、`dist/Gadget-popups.css` 与 sha256 清单作为 artifact 上传；
   - `release`：下载 artifact 并校验 sha256 后创建 GitHub Release，`Gadget-popups.js`、`Gadget-popups.css`、`sha256sums.txt` 三份文件作为 release assets 上传；workflow 重跑幂等（release 已存在时仅 `--clobber` 重传 assets）。本仓库不向旧仓库推送产物，旧仓侧同步由人工从 Release assets 获取。
3. 产物部署后按 [docs/smoke-test.md](./docs/smoke-test.md) 在真站点人工验证（静态门禁不含运行时行为对照）。

## 上游同步

同步英文维基百科上游更新时：**先读 [docs/functional-spec.md](./docs/functional-spec.md) 确定该功能在本仓的基准形态**，再用萌百代码风格把有价值的变更移植进对应 TS 模块，并在 [docs/semantic-notes.md](./docs/semantic-notes.md) 登记由此产生的偏差。注意事项：

- 产物头注释与本文档顶部均有警告：**萌百版相对上游有大量定制，禁止直接复制粘贴上游代码覆盖模块**。
- 上游是 31 个源文件的拼接产物，本仓**不再对齐**上游模块名、文件划分与加载顺序，只对齐功能；`build/fragments.json` 的模块对应表已随移植版退役删除。
- 专门的同步操作指南（docs/upstream-sync.md）随移植版退役一并删除，尚未重建；当前同步评估以 functional-spec + semantic-notes 为准。

## 工具链与旧仓同步

lint/commit/格式化工具链复制自 [MoegirlPediaInterfaceCodes](https://github.com/MoegirlPediaInterfaceAdmins/MoegirlPediaInterfaceCodes)（共享基座为 npm 包 `@annangela/eslint-config`）。与旧仓的配置一致性由 **config-sync** 机制维护：

- 清单 `build/config-sync-manifest.json`：28 项（24 `byte-equal` 逐字节一致 / 4 `adapted` 有意偏差 + 注记），各带 `lastSyncedHash` 锚点；`.mailmap` 为种子拷贝（两仓各自演进）不登记，`eslint.config.js` 为本仓独立结构不登记；
- 工作流 `.github/workflows/config-sync.yaml`：每周二 07:30（CST）+ 手动，检测漂移自动开 PR——byte-equal 项直接覆盖；adapted 项存档旧仓新版并附适配指引，须人工完成适配后合并；同文件已有 open PR 时去重评论；
- 开 PR 用 PAT（secret `CONFIG_SYNC_TOKEN`：fine-grained，仅本仓库 Contents RW + Pull requests RW）——`GITHUB_TOKEN` 创建的 PR 不触发 CI/commitLint。secret 未配置时工作流会红并提示。

### 新旧仓门禁对照

| 本仓门禁 | 对应旧仓检查 |
| --- | --- |
| src TS 严集 eslint（strict-type-checked） | —（超出旧仓，加强项） |
| dist 产物 browser 预设 eslint `--max-warnings 0` | `test:eslint`（对 dist 产物） |
| scripts/ + .husky/ + 根配置 node 预设 eslint | `lint:scripts` |
| dist CSS stylelint（standard + use-baseline，警告计败） | `test:stylelint` |
| dist CSS postcss 0 警告（同款 .postcssrc.yaml 插件链） | `scripts/postcss` 检查 |
| tsc `--noEmit`（strict，src） | —（旧仓不做，加强项） |
| acorn ecma2020 parse 产物（拦 es2021+ 泄漏） | —（新机制，守卫 es2020 目标） |
| tsc es2020 **emit** 编译 dist → 对 emit 产物 terser 试压缩 | 部署编译链（tsc es2020 → terser） |
| vitest + jsdom（1370 用例，coverage 四项 100%） | —（旧仓无测试，加强项） |
| commitlint：提交信息 + PR 标题（npm/gha 放行） | `commitLint.yaml` |
| mailmap 检查（本地 + CI，bot 豁免） | `test:mailmap` |
| CodeQL（actions + js/ts，paths-ignore dist） | `CodeQL.yaml`（旧仓曾整目录排除本 gadget，本仓正面分析） |
| dependabot（gha + npm，每日 07:30 分组） | `dependabot.yaml`（逐字节一致） |
| config-sync 漂移检测 | —（新机制） |

明确不复制旧仓的：`v8r` + gadget JSON Schema、postCommit 全套生成器、`selectRegistry` 测速装依赖、`auto_assign`。

## 贡献流程

1. 修改 `src/**/*.ts`（保持既有代码风格：4 空格缩进、双引号、模板字符串、async/await；新代码必须全类型）；
2. `npm test` 全绿；行为变更同步更新 `docs/functional-spec.md`，有意偏差登记 `docs/semantic-notes.md`；
3. PR 描述附上产物相对上一版的功能性变更摘要；
4. 合并后按需打 tag 触发 Release，并按 `docs/smoke-test.md` 人工验证。
