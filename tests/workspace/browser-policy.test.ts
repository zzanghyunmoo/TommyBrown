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
    "name:password@example.com",
    "//name:password@example.com",
    "http:example.com",
    "https:example.com",
    "http:\\\\example.com",
    "https://exam\nple.com",
    "not a URL",
  ])
    expect(() => browserUrl(url)).toThrow();
});

it.each([
  ["example.com", "https://example.com/"],
  [" example.com/path?q=hello#part ", "https://example.com/path?q=hello#part"],
  ["//example.com/path", "https://example.com/path"],
  ["localhost:3000", "https://localhost:3000/"],
  ["127.0.0.1:3210/path", "https://127.0.0.1:3210/path"],
  ["example.test:8443/path", "https://example.test:8443/path"],
  ["[::1]:3000", "https://[::1]:3000/"],
  ["HTTP://localhost:3000", "http://localhost:3000/"],
])("normalizes %s without silently opting into HTTP", (input, expected) => {
  expect(browserUrl(input)).toBe(expected);
});
