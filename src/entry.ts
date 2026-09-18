// 入口：本仓库中唯一允许注册全局副作用的模块。
//
// 双载入守卫沿用原版语义：window.pg 已存在且不是元素节点时，说明另一份
// 实例已在运行（mw.loader 正常不会双载入，但用户脚本手动引入时可能发生），
// 本份保持静默退出。
//
// 与原版（模块求值期展开全部定义与初始化）不同，重写版的所有初始化都
// 经由 boot() 在 ready/load 回调中显式执行——模块顶层零副作用是本仓库
// 的架构约束，也是测试可以直接 import 各模块的前提。
//
// window.pg 的装配不能推迟到 boot()：boot 在 ready 之后才运行，若标记
// 晚于守卫检查，ready 前的窗口期内另一份实例会通过守卫造成双载入，
// 因此守卫通过后立即同步标记。
import { boot } from "./boot.ts";
import { state } from "./state.ts";

const alreadyLoaded = !!window.pg && !(window.pg instanceof HTMLElement);

if (!alreadyLoaded) {
    window.pg = state;
    $(() => {
        if (document.readyState === "complete") {
            boot();
        } else {
            $(window).on("load", () => {
                boot();
            });
        }
    });
}
