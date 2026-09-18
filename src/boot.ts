// 初始化编排：siteinfo 查询 → 各域 setup → setupTooltips。
// 阶段 0 仅落地骨架；随重写推进，各域模块就绪后在此按依赖顺序填充调用。
// TODO(rewrite): 填充实际初始化序列 → 阶段 1 起各域模块逐步落地时
export const boot = (): void => {
    // 占位实现（见文件头 TODO）；非空函数体仅为满足 no-empty-function
};
