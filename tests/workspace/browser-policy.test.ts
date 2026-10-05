import { expect, it } from "vitest";
import { browserUrl } from "../../src/shared/browser";

it("allows web navigation including local development servers", () => {
  expect(browserUrl(" https://example.com/path ")).toBe(
    "https://example.com/path",
  );
  expect(browserUrl("http://127.0.0.1:3210/")).toBe("http://127.0.0.1:3210/");
});
it("refuses local files, scripts, custom schemes, and embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///private/note",
    "data:text/html,hello",
    "obsidian://open",
    "https://name:password@example.com",
    "not a URL",
  ])
    expect(() => browserUrl(url)).toThrow();
});
