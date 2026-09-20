// autoedit 域先头件单元测试：autoClickToken 透传 mw.user.sessionId。
// 其余 autoedit 管线用例随阶段 4 actions 域扩充。
import { describe, expect, it } from "vitest";
import { installMw } from "../../helpers/mockMw.ts";
import * as Autoedit from "../../../src/actions/autoedit.ts";

describe("autoClickToken", () => {
    it("返回 mw.user.sessionId()", () => {
        installMw({ sessionId: "session-xyz" });
        expect(Autoedit.autoClickToken()).toBe("session-xyz");
    });
});
