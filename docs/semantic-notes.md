# 已知行为差异登记（产物 vs 原单文件版本）

本仓库产物 `dist/Gadget-popups.js` 与萌百原单文件版本（MoegirlPediaInterfaceCodes 中的
`src/gadgets/Navigation_popups/Gadget-popups.js`）存在以下**已知且有意的**行为差异。
验收原则是「功能一致即可，不追求逐字节一致」；每条差异在此登记其成因与安全论据。
新的有意差异必须在此追加登记。

## 1. 模块定义在脚本加载期求值（原为 DOM ready 回调内）

**现象**：原版全部代码包在 `$(() => { … })`（jQuery ready 回调）里，模块声明与顶层
语句在 DOM ready 后才求值；ESM 化后 33 个模块在脚本**加载期**求值。

**安全论据**：模块顶层只有声明与数据赋值（正则字面量、`pg` 各域填充、常量表），
不存在读 DOM 的顶层语句；原来与 ready 时序相关的行为全部仍经由 `entry.ts` 中的
jQuery-ready / `mw.hook` 注册触发，时序不变。原版在回调开头处的「已加载即 return」
双载入守卫，改为 `globals.ts` 的 `alreadyLoaded` 旗标：加载期检测到 `window.pg`
已存在时，跳过 `window.pg` 赋值与 entry 的 ready/钩子注册——与原版 return 语义等价。

## 2. 行内注释被剥离（产物只剩 banner）

**现象**：esbuild 转译时剥离全部行内注释，产物仅保留 `rollup.config.js` 中的 banner
（eslint 头、`@source` oldid、勿复制警告、`"use strict"`）。

**安全论据**：注释不影响运行时行为。旧仓部署侧本就对产物执行 terser 压缩
（部署版同样没有行内注释），最终上线文件的行为不受影响；产物头的 `@source` 与
警告信息按原样保留在 banner 中。

## 3. es2020 降级：class 字段编译为 `__publicField` 辅助函数

**现象**：构建 target 由 es2022 下调为 **es2020**（对齐旧仓部署侧
`tsc --project tsconfig.production.json`（target es2020）+ terser（ecma 2020））。
esbuild 将 class 字段（`x = …`）降级为 `__publicField(ClassName, "x", value)`
（内部为 `Object.defineProperty`），而旧仓部署侧 tsc 的降级是构造函数内的
`this.x = …` 赋值。实测产物 263399 → 268745 字节，约 498 行差异。

**安全论据**：`Object.defineProperty` 与 `this.x = …` 赋值的差别仅在字段恰好与
**原型上的 setter** 同名时才会显现（defineProperty 不会触发原型 setter，赋值会）。
本仓库所有 class（`Navpopup`、`Title`、`Downloader`、`Previewmaker`、`NavlinkTag` 等）
均为内部类，其原型上没有任何 setter，两种降级产物行为完全一致。阶段 3 的
「tsc es2020 emit → terser」门禁链会按旧仓部署顺序复刻验证产物可被同参数工具链处理；
上线后由人工冒烟清单兜底（见 README）。

## 4. 类型转换改写：`Boolean()`/`Number()` → `!!`/`+`（14 处）

**现象**：原单文件版本源码为 0 处 `Boolean()`/`Number()` 构造函数调用；TS 移植期
为满足 strict 类型新写了 14 处（`globals.ts` 1 处 `Boolean`、`actions.ts` 1 处
`Boolean`、`actions.ts`/`images.ts`/`pageinfo.ts`(2)/`previewmaker.ts`(2)/
`diffpreview.ts`(6) 共 12 处 `Number`）。现全部改写为 `!!x` / 一元 `+x`。

**安全论据**：ECMAScript 规范中 `Number(x)` 与一元 `+x` 都执行 **ToNumber**，
`Boolean(x)` 与 `!!x` 都执行 **ToBoolean**——运行期语义完全一致，纯文本层面等价。
具体写法按联合类型分三类（tsc strict 与 eslint 严集双约束下的唯一可行形态）：

- `pg.option`/`getValueOf`（值联合含 null/undefined/object）8 处：
  `+(x as string | number)`——断言仅做编译期收窄，运行时仍是 ToNumber(原值)；
- `DiffSide.revid`（`number | undefined`）2 处：`+(revid ?? NaN)`——
  `Number(undefined)` 本就是 `NaN`，`?? NaN` 精确保持该语义；
- `pg.re` 括号计数（`RegExp | number`）2 处：`+(x as number)` + 单行 scoped
  `eslint-disable`（`no-unnecessary-type-conversion` 规则只看断言后的类型，
  无法感知断言前的联合，属规则盲区；理由注释见 `pageinfo.ts`）。

另有一处衍生改动：`actions.ts` `modifierPressed` 的 `String(mod as …)` 断言因
`!!` 的真值收窄被 lint 判定为不必要而去除，改为 `String(mod)`（断言是编译期
操作，去除无运行时影响）。`eslint.config.js` 已加 `no-restricted-syntax` 禁用
`Boolean()`/`Number()` 两条构造函数调用，防回归。

## 5. 产物无 IIFE 包装、构建期 lint-fix 与模块级 "use strict" 剥除

**现象**：相对原单文件版本，产物包装形态、排版与头部有四处连带改动：

1. rollup 出料由 IIFE 包装改为**裸顶层语句**（`format: "es"`；entry 零导出，
   无 import/export 残留，build.js 门禁校验）；
2. 头部 eslint-disable 仅保留 2 条结构性的（`no-use-before-define,
   camelcase`），其余豁免全部取消——产物在构建期内被 `eslint`（API 方式）
   **自动修复排版并复检**，与手写代码同规则门禁；
3. esbuild 给每个模块注入的 `"use strict";` 序言（34 条）由 build.js 剥除，
   banner 的全局指令成为产物唯一一条；
4. 产物排版由 esbuild 原生输出改为本仓 lint 基座要求的形态（4 空格缩进、
   多行尾逗号等，260891 字节）。

**安全论据**：

- **无包装**：gadget 恒经 mw ResourceLoader 下发，`mw.loader.implement` 在函数层
  执行页面脚本，顶层作用域天然隔离——顶层 `const/let` 本就不上 `window`，
  `var`/函数声明在 RL 包装内是局部。若产物脱离 RL 被直接 `<script>` 引用，顶层
  `var` 才会泄漏到全局，当前部署路径（wiki 页面脚本）不存在该用法。
- **构建期 lint-fix**：es2020 目标曾经的必然违规已全部源头/管线消除——源码
  零 `??=`/`||=`（7 处改写为语义等价的 if 形态；`??=` 的降级产物会触发
  logical-assignment-operators，且其成员链降级引入 esbuild 的 `var _a` 辅助）；
  esbuild 的 `let X = _X;` 类别名由 build.js 定点提升为 const（别名从不重赋值，
  prefer-const 无 fixer）；其余排版规则（`@stylistic/*` 等）由 build.js 对产物
  跑本仓 eslint 的 fix（fixer 不改语义、不改注释）统一重排，随后**免 fix 复检**
  将产物 lint 变为构建门禁——banner 未豁免的任何违规都会使构建失败。排版改动
  不触碰 AST 语义，acorn es2020 门禁与「tsc es2020 emit + terser」部署等价链
  照常把关。保留的 2 条均为结构性：`no-use-before-define`——上游 helpers
  bottom-up 排序是刻意的求值顺序契约，重排会改变模块求值顺序（src 侧同款
  off）；`camelcase`——上游与 wiki/DOM 契约标识符（wpTextbox1、wikEdUseWikEd、
  last_attr…）1:1 保留以便上游补丁仍可应用。两条均须在产物中有 ≥1 现存违规
  （本仓 `reportUnusedDisableDirectives` 把零违规条目报为错误），且旧仓 CI 的
  base+browser lint 对回传文件开启这两条（旧仓仅全局忽略自家 `**/dist/**`），
  banner 保证两侧 CI 都过。`promise/prefer-await-to-callbacks` 走本仓 config
  的 src+dist 统一 off 条目（旧仓对全部 browser 文件全局关闭该规则，进 banner
  反而会成旧仓的 unused directive）。
- **剥指令**：tsconfig 基座 `alwaysStrict: true` 令 esbuild 给每个模块注入一条
  序言；TS 6.0 禁止显式设 `alwaysStrict: false`（TS5107），无法在源头关闭，
  只能在 build.js 后处理剥除——只删整行恰为 `"use strict";` 的行，源内无该
  字面量、无误伤面。剥除后产物唯一全局指令在 banner（与原版位置一致）；模块
  序言与全局指令对这份平铺单层产物等价，strict 语义不变。
