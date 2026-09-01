# 上游同步操作指南（供 AI / 维护者在执行同步任务时阅读）

本文档在**执行 Navigation popups 上游同步任务时**读取一次，描述如何把英文维基百科上游的更新合并到本仓库的片段中。不执行同步任务时无需关心本文。

产物头注释与 README 均有警告：**萌百版相对上游有大量定制，禁止直接复制粘贴上游代码覆盖片段**。同步 = 理解上游变更 → 用萌百代码风格把有价值的变更手工移植进对应片段。

## 0. 前置事实（已核实，直接采信）

- 上游部署页面是 31 个源文件的构建期拼接产物，各源文件边界由 `// STARTFILE: <name>.js` / `// ENDFILE: <name>.js` 注释标记。**除第一个标记外，所有标记行都有且仅有一个前导 TAB**（即 `\t// STARTFILE: x.js`），切分时不要按行首严格匹配。
- 上游源文件本身就是语法不闭合的片段（`main.js` 打开 `$( () => {` 不闭合，`run.js` 末尾 `});` 闭合），拼接后才成立。本仓库片段同理。
- 本仓库片段 = 萌百版单文件产物的精确字节切片，片段间**没有任何分隔空行**，每个片段恰好以一个换行结尾。顺序唯一记录在 `build/fragments.json`。
- 构建零转换：`npm run build` 产物与片段拼接字节一致。**修改片段后严禁运行任何格式化工具**（prettier 等）；保持 4 空格缩进、双引号、模板字符串、async/await 风格。

## 1. 拉取上游

```bash
# 最新版
curl -fsSL 'https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&action=raw' -o /tmp/upstream-latest.js
# 固定 oldid（当前萌百基线）
curl -fsSL 'https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&oldid=1322962085&action=raw' -o /tmp/upstream-base.js
```

记录最新版的 oldid：从页面 `?action=info` 或历史页获取，同步完成后要更新 `src/_header.js` 里的 `@source` 链接。

## 2. 切分上游

按 STARTFILE/ENDFILE 标记把 `/tmp/upstream-latest.js` 切成 31 个文件（注意前导 TAB）。可以用脚本，也可以让 AI 直接按标记定位行号切片。切分后应得到：`main.js, actions.js, domdrag.js, structures.js, autoedit.js, downloader.js, livepreview.js, pageinfo.js, titles.js, getpage.js, parensplit.js, tools.js, dab.js, htmloutput.js, mouseout.js, previewmaker.js, querypreview.js, debug.js, images.js, namespaces.js, selpop.js, navpopup.js, diff.js, init.js, navlinks.js, shortcutkeys.js, diffpreview.js, links.js, options.js, strings.js, run.js`。

## 3. 逐文件对比

对每个上游文件与本仓库 `src/` 同名片段做 diff。**直接 diff 全是噪音**，先做两层预处理再比：

1. 缩进：上游 TAB → 展开；萌百版整包在 `$( () => {` 内有 4 空格基础缩进，对比时先剥掉这层缩进；
2. 语义对照优先：比较函数/类声明序列（名字与顺序），先定位「上游新增/删除/重命名了哪些函数」，再看具体函数体的 diff。

### 萌百版已知差异清单（对比时排除这些既有差异，剩下的才是上游新变更）

- **函数挪动**（上游文件 → 萌百所在片段）：`log`/`errlog`（debug.js → main.js）；`nonGlobalRegex`（parensplit.js → tools.js）；`Mousetracker`（navpopup.js → selpop.js）；`titledDiffLink`（links.js → diffpreview.js）；`pg.structures.original` 定义（structures.js 头部 → domdrag.js 片段尾部）。
- **已删除的上游函数**：`findInArray`、`nextOne`、`isNumber`、`isObject`、`isFunction`、`repeatString`（tools.js）；`previewSteps`（previewmaker.js）；`useDefaultOptions`（options.js）；debug.js 削成一行桩（`setupDebugging`）。
- **萌百独有内容**：`_header.js`（eslint 指令 + 警告 + `"use strict"` + 包裹开头）；`_popupStrings.js`（237 项 wgULS 翻译表，上游靠外部 `window.popupStrings` 注入）；`strings.js` 中 `popupNoTranslation` Set + console.info 记录。
- **风格改造**：整体 async/await 化；prettier 风格（4 空格、双引号、模板字符串、箭头函数、class 字段）；`$(window).on("load")`/readyState 分支。
- **功能性定制**（同步时必须保留，不得被上游覆盖）：Moeskin/vector-2022 容器选择器链（actions.js）；`wpChangeTags`（autoedit.js）；`formatAge` 的 moment 日历差值实现（pageinfo.js）；`namespaceId` try/catch（titles.js）；`group-no-autoconfirmed` 加粗与中文顿号分隔（querypreview.js）；interwiki 仅 zh/en/ja（namespaces.js）；依赖改由 ResourceLoader 加载、`Api-User-Agent`、`uselang:"content"`、`maxage:3600`（init.js）；编辑计数/arin/google 链接 zh 调整（links.js）；`run()` 直接调 `autoEdit()`+`setupPopups()` 与 `wikipage.content`/echo 钩子注册（run.js）。

## 4. 合并上游变更

- 只把**确实需要**的上游修复/功能移植进对应片段，用萌百风格改写；每处变更都要能说清来源（上游哪个函数的哪处改动）。
- 上游新增顶层函数 → 放进对应片段中该函数在上游文件里的相对位置；上游删除函数 → 从片段删除（若被萌百定制依赖则保留并在 PR 说明）。
- 上游若新增/删除源文件（31 个之外），同步调整 `build/fragments.json`（顺序 = 上游拼接顺序）并新增/删除片段，保持连续分区性质：片段拼接必须仍是完整合法产物。
- 同步完成后更新 `src/_header.js` 的 `@source` oldid 链接。

## 5. 验证与发布

```bash
npm test          # 全部门禁必须绿
git diff --stat   # 复查改动面
node scripts/build.mjs && git diff --no-index --stat dist/Gadget-popups.js <上一版本产物>   # 评估产物 diff（可选）
```

提交（conventional commits，scope 用 `Gadget/Navigation_popups` 不适用本仓库——本仓库直接用常规 scope，如 `feat(upstream): …`/`fix(upstream): …` 并注明上游 oldid），合并到 master 后打 tag `vX.Y.Z` 触发 Release 工作流上传 artifact；回传 PR 任务当前停用（见 `.github/workflows/release.yml` 注释）。

## 6. 红线

- 禁止整文件覆盖式同步；
- 禁止对片段运行格式化工具或改动无关行；
- 任何情况下产物必须是片段的纯字节拼接（`npm run test` 的幂等与门禁会兜底）；
- 同步后旧仓库侧只应看到产物文件的变更（回传机制负责），不要在旧仓库手改产物。
