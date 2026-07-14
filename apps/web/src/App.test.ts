import { describe, expect, it } from "vitest";
import { goalStates, isVersionSupported } from "./App";

describe("独立三星展示", () => {
  it("挑战星不会错误点亮最优星", () => {
    expect(goalStates({ starDetails: { completion: true, optimal: false, challenge: true } })).toEqual({
      completion: true, optimal: false, challenge: true,
    });
  });

  it("拒绝低于服务端最低要求的客户端", () => {
    expect(isVersionSupported("1.1.0", "1.1.0")).toBe(true);
    expect(isVersionSupported("1.0.9", "1.1.0")).toBe(false);
    expect(isVersionSupported("2.0.0", "1.9.9")).toBe(true);
  });
});
