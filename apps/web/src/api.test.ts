import { describe, expect, it } from "vitest";
import { requestHeaders } from "./api";

describe("API 请求头", () => {
  it("无请求体 POST 不发送 JSON content-type", () => {
    const headers = requestHeaders({ method: "POST" }, null);
    expect(headers.has("content-type")).toBe(false);
  });

  it("JSON 请求体发送 content-type 并保留身份令牌", () => {
    const headers = requestHeaders({ method: "POST", body: "{}" }, "token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBe("Bearer token");
  });

  it("调用方可以覆盖默认请求头", () => {
    const headers = requestHeaders({ body: "data", headers: { "content-type": "text/plain" } }, null);
    expect(headers.get("content-type")).toBe("text/plain");
  });
});
