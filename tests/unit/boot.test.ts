// boot 阶段 0 占位的直测（entry.test.ts 对 boot 做了 vi.mock，真身在此覆盖）
import { describe, expect, it } from "vitest";
import { boot } from "../../src/boot.ts";

describe("boot（阶段 0 占位）", () => {
    it("可直接调用且不抛错", () => {
        expect(() => {
            boot();
        }).not.toThrow();
    });
});
