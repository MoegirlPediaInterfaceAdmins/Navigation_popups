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

**现象**：esbuild 转译时剥离全部行内注释，产物仅保留 `rollup.config.mjs` 中的 banner
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

## 5. 产物 banner 的 eslint-disable 扩充（3 条）

**现象**：产物头部 eslint-disable 由原版的 3 条（`no-unused-vars,
no-use-before-define, camelcase`）扩为 6 条（追加 `no-var, prefer-const,
logical-assignment-operators`）。

**安全论据**：构建 target es2020 下，esbuild 必然把源码中的 `??=`/`||=`
（es2021 语法）降级回普通赋值表达式，且 class 字段辅助代码使用 var/let 形态；
而 lint 基座的 base 预设要求使用逻辑赋值运算符（即要求 es2021+ 语法）——
**规则要求与产物目标版本天然冲突**，产物必须保持 es2020（旧仓部署链为
tsc es2020 + terser ecma 2020），故这三条规则对产物永久豁免。豁免通过产物
banner 自带（而非改本仓 lint 配置的 dist 段），保证产物回传旧仓后经旧仓 CI
的 browser 预设 lint 时同样通过（旧仓 `src/gadgets/Navigation_popups/` 无
`.eslintrc.yaml` 局部豁免）。
