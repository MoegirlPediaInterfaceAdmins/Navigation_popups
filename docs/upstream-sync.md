# 上游同步操作指南（供 AI / 维护者在执行同步任务时阅读）

本文档在**执行 Navigation popups 上游同步任务时**读取一次，描述如何把英文维基百科上游的更新合并到本仓库的 TypeScript 模块中。不执行同步任务时无需关心本文。

产物头注释与 README 均有警告：**萌百版相对上游有大量定制，禁止直接复制粘贴上游代码覆盖模块**。同步 = 理解上游变更 → 用萌百代码风格把有价值的变更移植进对应 TS 模块。

## 0. 前置事实（已核实，直接采信）

- 上游部署页面是 31 个源文件的构建期拼接产物，各源文件边界由 `// STARTFILE: <name>.js` / `// ENDFILE: <name>.js` 注释标记。**除第一个标记外，所有标记行都有且仅有一个前导 TAB**（即 `\t// STARTFILE: x.js`），切分时不要按行首严格匹配。
- 上游源文件是语法不闭合的片段（`main.js` 打开 `$( () => {` 不闭合，`run.js` 末尾 `});` 闭合）。本仓库已改为 ESM 模块：每个文件独立合法，`$( () => {` 包裹与双载入守卫在 `entry.ts` / `globals.ts`。目录布局：`src/` 顶层只有 `entry.ts`、`globals.ts`、`popupStrings.ts` 与 `types/`，**30 个上游对应模块在 `src/modules/`**。
- **模块 ↔ 上游文件对应表就是 `build/fragments.json`**（`main.js → globals.ts`、`_popupStrings → popupStrings.ts`、`run.js → run.ts`（仅 run 函数；ready 分支与钩子注册在 `entry.ts`）、其余同名；`file` 字段是相对 `src/` 的路径，模块层带 `modules/` 前缀）。
- 顶层副作用顺序约束：entry 的 import 顺序 = 原片段顺序；Rollup 拓扑微调后仍须满足——`pg` 字面量最先（globals.ts）、`domdrag.ts` 填充 `pg.structures.original` 先于 `structures.ts` 的 `copyStructure` 调用、entry 的注册最后。若同步引入新的顶层副作用，必须核对依赖顺序（必要时调整 entry 的 import 序）。
- 循环依赖：模块互相 import、运行期互调是上游结构的常态，rollup `onwarn` 只放行 `CIRCULAR_DEPENDENCY`（其余警告一律 fatal）。同步时不必消环，但避免加剧；跨模块调用都发生在所有模块体求值完毕之后。
- **质量基线**：全部 33 模块处于 strict tsc + 严集 eslint 之下，当前为 **0 类型错误 / 0 lint 违规**，无 `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error`。移植后的代码必须保持这个基线（见 §4）。
- 构建零转换假设：esbuild 转译会**剥掉普通注释**（产物中只剩 banner）；源码注释照常写。
- **构建 target 是 es2020**（对齐旧仓部署链 tsc es2020 + terser ecma 2020）：源码可用 es2022 语法，但 esbuild 会把 class 字段降级为 `__publicField` 辅助（见 `docs/semantic-notes.md` #3）；产物另有 acorn `ecmaVersion: 2020` parse 门禁兜底（es2021+ 语法**不得**以形态保留到产物——正常构建不会，改构建配置时注意）。产物 banner 的 eslint-disable 为 6 条（原版 3 条 + es2020 降级形态所需 `no-var, prefer-const, logical-assignment-operators`），同步时保留。
- **模块边界曾以 AST 级验证**（espree 双侧解析 → jQuery 回调顶层语句序列 → 声明名锚点对齐，31 模块顺序与上游一致）。上游文件变更后可重跑该验证再生物段表；日常同步以 `build/fragments.json` 为唯一对应表。

## 1. 拉取上游

```bash
# 最新版 JS
curl -fsSL 'https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&action=raw' -o /tmp/upstream-latest.js
# 固定 oldid（当前萌百 JS 基线）
curl -fsSL 'https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085&action=raw' -o /tmp/upstream-base.js
# 最新版 CSS（当前萌百 CSS 基线 oldid=825269631）
curl -fsSL 'https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-navpop.css&action=raw' -o /tmp/upstream-latest.css
```

记录最新版 oldid（页面 `?action=info` 或历史页）；同步完成后更新 `rollup.config.mjs` banner（JS）与 `scripts/build-css.mjs` banner（CSS）里的 `@source` 链接，以及 `build/fragments.json` 两个 `oldid` 字段。

## 2. 切分上游

按 STARTFILE/ENDFILE 标记把上游切成 31 个文件（注意前导 TAB），切分后应得到：`main.js, actions.js, domdrag.js, structures.js, autoedit.js, downloader.js, livepreview.js, pageinfo.js, titles.js, getpage.js, parensplit.js, tools.js, dab.js, htmloutput.js, mouseout.js, previewmaker.js, querypreview.js, debug.js, images.js, namespaces.js, selpop.js, navpopup.js, diff.js, init.js, navlinks.js, shortcutkeys.js, diffpreview.js, links.js, options.js, strings.js, run.js`。

## 3. 逐文件对比

对每个上游文件与本仓库对应 `src/*.ts` 做 diff。直接 diff 全是噪音，先做两层预处理：

1. 缩进：上游 TAB 展开；本仓库模块是顶层缩进（原片段在 `$( () => {` 内的 4 空格基础缩进已归零）；
2. 语义对照优先：比较函数/类声明序列（名字与顺序），先定位「上游新增/删除/重命名了哪些函数」，再看具体函数体 diff。

### 萌百版已知差异清单（对比时排除这些既有差异，剩下的才是上游新变更）

- **函数挪动**（上游文件 → 本仓库模块）：`log`/`errlog`（debug.js → globals.ts）；`nonGlobalRegex`（parensplit.js → tools.ts）；`Mousetracker`（navpopup.js → selpop.ts）；`titledDiffLink`（links.js → diffpreview.ts）；`pg.structures.original` 定义（structures.js 头部 → domdrag.ts 顶部）。
- **已删除的上游函数**：`findInArray`、`nextOne`、`isNumber`、`isObject`、`isFunction`、`repeatString`（tools.js）；`previewSteps`（previewmaker.js）；`useDefaultOptions`（options.js）；debug.js 削成一行桩。
- **萌百独有内容**：`popupStrings.ts`（237 项翻译表，上游靠外部 `window.popupStrings`）；`strings.ts` 的 `popupNoTranslation` Set；`globals.ts` 的 `alreadyLoaded` 双载入旗标；`entry.ts` 的 ready/钩子注册。
- **风格改造**：整体 async/await 化；4 空格缩进、双引号、模板字符串、class 字段语法；`$(window).on("load")`/readyState 分支（在 entry.ts）。
- **功能性定制**（同步时必须保留，不得被上游覆盖）：Moeskin/vector-2022 容器选择器链（actions.ts）；`wpChangeTags`（autoedit.ts）；`formatAge` 的 moment 日历差值实现（pageinfo.ts）；`namespaceId` try/catch（titles.ts）；`group-no-autoconfirmed` 加粗与中文顿号分隔（querypreview.ts）；interwiki 仅 zh/en/ja（namespaces.ts）；依赖由 ResourceLoader 加载、`Api-User-Agent`、`uselang:"content"`、`maxage:3600`（init.ts）；编辑计数/arin/google 链接 zh 调整（links.ts）；`run()` 直接调 `autoEdit()`+`setupPopups()`。

## 4. 合并上游变更（TS 移植规范）

- 只把**确实需要**的上游修复/功能移植进对应模块，用萌百风格改写；每处变更都要能说清来源（上游哪个文件哪处改动）。
- **移植形态**：上游的 `function foo(a, b) {…}` → `export const foo = (a: T1, b: T2): R => {…}`（仅在模块自身需要导出时 export；被其他模块引用的必须 export 并在引用方 import）。新增顶层声明后运行 `npm run build`——若被引用却未导出，rollup 会报 `is not exported by`。
- **类型要求**：新代码必须全类型（参数/返回值/结构），**禁止新增 `any` 与任何 ts-comment**（`@ts-ignore`/`@ts-nocheck`/`@ts-expect-error` 全仓为零，保持）。strict tsc 与严集 eslint 都是零基线，移植完 `npm test` 必须仍然全绿。
- **非空断言的写法**：上游常见的"此处必非空/必为某形状"运行时不变量，用 `tools.ts` 的 `assume<T>(value)` 表达——恒等函数、运行时零开销。不要写 `!`（`no-non-null-assertion` 禁止），也不要写会被 `non-nullable-type-assertion-style` 改写回 `!` 的裸 `as`；确需双重断言时 `as unknown as T`。
- **与 lint 规则冲突的上游行为**：若上游行为本身触发某规则（如 retry 计数用 `|| 0`、`window.event`/`keyCode` legacy API、`unescape`），用**单行 scoped `eslint-disable-<rule> -- 理由`** 承接，理由必须注明上游行为依据（存量约 38 处可作范例；`shortcutkeys.ts` 是唯一的文件级豁免）。禁止无理由 disable、禁止多行 disable 注释（不生效）。
- **TS 语法注意**：`noFallthroughCasesInSwitch` 下，上游的 switch 贯串分支要改写成合并 case 标签（`case A: case B:`）；类型窄化用字面量 `typeof x === "string"`（`typeof x === typeof ""` 不窄化）；`Record` 索引访问的判空以实际类型为准。字符串语义等价转换可放心用：`String(x)` 与模板拼接 `` `${x}` `` 运行时一致。
- 上游新增/删除源文件（31 个之外）→ 在 `src/modules/` 新建/删除对应模块，同步更新 `build/fragments.json`（`file` 填 `modules/<name>.ts`）与 `entry.ts` 的 import 序（`./modules/<name>.ts`，保持原拼接顺序语义）。
- 同步完成后更新 `rollup.config.mjs` banner 里的 `@source` oldid。

### CSS 同步（Gadget-navpop.css）

CSS 与 §4 的 JS 移植并行，源在 `src/css/`：`main.scss` 平铺部分 = 上游 Gadget-navpop.css（oldid=825269631）+ 萌百定制（`.navpopup` 的 `line-height: normal`、`.popupPreview td` 两条 word-break）；`_darkmode.scss` 是**萌百本地专属**的暗色适配（16 组规则 × 三变体 mixin）。

- 上游 CSS 有更新时：diff `/tmp/upstream-latest.css` 与基线，把上游变更**用 SCSS 风格移植进 `main.scss` 平铺部分**（值形态沿用萌百现行：十六进制大写、`rgb(… / …%)` 现代颜色语法、`overflow-wrap`——build-css 会做 rgba→rgb 后处理，但源文件保持现代写法）；禁止整文件覆盖。
- **暗色区（`_darkmode.scss`）与萌百定制行不得被上游内容覆盖**——上游无暗色适配。
- 若上游新增/删除规则，同步更新 `_darkmode.scss` 中对应的暗色组（16 组与平铺区规则一一对应）。
- 对应表登记在 `build/fragments.json` 的 `stylesheets` 节。

## 5. 验证与发布

```bash
npm test          # 全部门禁必须绿：rollup 零警告（循环依赖除外）、eslint 严集 0 违规、
                  #   stylelint 0 违规 0 警告、tsc strict 0 错误、acorn es2020 parse、
                  #   tsc-es2020 emit → terser 部署链、幂等（JS/CSS）、postcss 0 警告、
                  #   mailmap、commitlint
```

提交（conventional commits，注明上游 oldid），合并到 master 后打 tag `vX.Y.Z` 触发 Release 工作流上传 artifact；回传任务当前停用（见 `.github/workflows/release.yml` 注释）。产物合入旧仓库部署后，按 README 的**人工冒烟清单**过一遍核心路径。

## 6. 红线

- 禁止整文件覆盖式同步（上游 JS 直接替换 TS 模块、上游 CSS 直接替换 SCSS）；
- 禁止对源码运行格式化工具或提交无关改动；
- 不得开启 tree shaking、不得改动「treeshake: false / 模块全量断言 / entry import 顺序即副作用顺序」这三条构建不变量；
- 不得改动 es2020 构建目标（产物会被 acorn 门禁拦截）；
- `_darkmode.scss` 与萌百定制行不得被上游同步覆盖；
- 禁止新增 `any`、ts-comment（`@ts-ignore`/`@ts-nocheck`/`@ts-expect-error`）与无理由的 eslint disable；
- 任何产物变更合入旧仓库后执行人工冒烟清单。
