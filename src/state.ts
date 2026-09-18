// 类型化运行时状态容器：取代原版 pg 的动态域，各域字段随重写阶段迁入。
// 对外兼容面（javascript:pg.fn.* 内联 URL、用户脚本 pg.option 调试）依赖
// window.pg 指向本容器，由 entry 在守卫通过后立即装配（见 entry.ts）。
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 阶段 0 骨架暂态，各域字段自阶段 1 起迁入后移除本行
export interface PopupState {
    // 各域状态字段随阶段迁入（option / wiki / user / cache / ...）
}

export const state: PopupState = {};
