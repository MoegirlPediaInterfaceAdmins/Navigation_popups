// vitest setupFiles：先于每个测试文件的全部 import 执行。
// src 模块按「顶层零副作用」设计，但 i18n 翻译表在顶层求值时调用站点
// 提供的 wgULS，因此站点全局必须在任何 src 模块被 import 前装好。
import jquery from "jquery";

// 简体直通（zh 站默认变体）；需要断言繁体/地域变体的用例可局部覆盖。
// Object.assign 绕开 ambient declare const 的只读约束，且避免 any 收窄。
Object.assign(globalThis, {
    wgULS: (cn: string): string => cn,
    $: jquery,
});
