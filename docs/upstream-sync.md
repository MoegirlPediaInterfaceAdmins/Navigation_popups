# 上游同步操作指南（供 AI / 维护者在执行同步任务时阅读）

本文档在**执行 Navigation popups 上游同步任务时**读取一次，描述如何把英文维基百科上游的更新合并到本仓库的 TypeScript 模块中。不执行同步任务时无需关心本文。

产物头注释与 README 均有警告：**萌百版相对上游有大量定制，禁止直接复制粘贴上游代码覆盖模块**。同步 = 理解上游变更 → 用萌百代码风格把有价值的变更移植进对应 TS 模块。

## 0. 前置事实（已核实，直接采信）

- 上游部署页面是 31 个源文件的构建期拼接产物，各源文件边界由 `// STARTFILE: <name>.js` / `// ENDFILE: <name>.js` 注释标记。**除第一个标记外，所有标记行都有且仅有一个前导 TAB**（即 `\t// STARTFILE: x.js`），切分时不要按行首严格匹配。
- 上游源文件是语法不闭合的片段（`main.js` 打开 `$( () => {` 不闭合，`run.js` 末尾 `});` 闭合）。本仓库已改为 ESM 模块：`src/*.ts` 每个文件独立合法，`$( () => {` 包裹与双载入守卫在 `entry.ts` / `globals.ts`。
- **模块 ↔ 上游文件对应表就是 `build/fragments.json`**（`main.js → globals.ts`、`_popupStrings → popupStrings.ts`、`run.js → run.ts`（仅 run 函数；ready 分支与钩子注册在 `entry.ts`）、其余同名）。
- 顶层副作用顺序约束：entry 的 import 顺序 = 原片段顺序；Rollup 拓扑微调后仍须满足——`pg` 字面量最先（globals.ts）、`domdrag.ts` 填充 `pg.structures.original` 先于 `structures.ts` 的 `copyStructure` 调用、entry 的注册最后。若同步引入新的顶层副作用，必须核对依赖顺序（必要时调整 entry 的 import 序，并保持无循环依赖加剧）。
- 构建零转换假设：esbuild 转译会**剥掉普通注释**（产物中只剩 banner）；源码注释照常写。

## 1. 拉取上游

```bash
# 最新版
curl -fsSL 'https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&action=raw' -o /tmp/upstream-latest.js
# 固定 oldid（当前萌百基线）
curl -fsSL 'https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085&action=raw' -o /tmp/upstream-base.js
```

记录最新版 oldid（页面 `?action=info` 或历史页）；同步完成后更新 `rollup.config.mjs` banner 里的 `@source` 链接。

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
- **类型要求**：新代码必须全类型（参数/返回值/结构），**禁止新增 `any`** 与新的 `@ts-nocheck`/`eslint-disable` 承接头。若在仍带承接头的 legacy 模块内工作，鼓励顺手移除该文件的承接头并补全类型（独立 PR 优先）。
- 上游新增/删除源文件（31 个之外）→ 新建/删除对应模块，同步更新 `build/fragments.json` 与 `entry.ts` 的 import 序（保持原拼接顺序语义）。
- 同步完成后更新 `rollup.config.mjs` banner 里的 `@source` oldid。

## 5. 验证与发布

```bash
npm test          # 全部门禁必须绿（rollup 零警告、eslint 严集、tsc strict、terser、幂等）
```

提交（conventional commits，注明上游 oldid），合并到 master 后打 tag `vX.Y.Z` 触发 Release 工作流上传 artifact；回传任务当前停用（见 `.github/workflows/release.yml` 注释）。产物合入旧仓库部署后，按 README 的**人工冒烟清单**过一遍核心路径。

## 6. 红线

- 禁止整文件覆盖式同步（上游 JS 直接替换 TS 模块）；
- 禁止对源码运行格式化工具或提交无关改动；
- 不得开启 tree shaking、不得改动「treeshake: false / 模块全量断言 / entry import 顺序即副作用顺序」这三条构建不变量；
- 任何产物变更合入旧仓库后执行人工冒烟清单。
