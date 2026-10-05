import { describe, expect, it } from "vitest";
import { PrefixKeys } from "../../src/main/workbench/shortcuts";

const key = (value: string, control = false, shift = false) => ({
  type: "keyDown",
  key: value,
  control,
  shift,
  alt: false,
  meta: false,
  isAutoRepeat: false,
  isComposing: false,
});
describe("Herdr prefix keys", () => {
  it("preserves ordinary terminal input until the prefix is pressed", () => {
    const keys = new PrefixKeys();
    expect(keys.input(key("c", true))).toEqual({ consumed: false });
    expect(keys.input(key("v"))).toEqual({ consumed: false });
    keys.input(key("b", true));
    expect(keys.input(key("v"))).toEqual({
      consumed: true,
      command: "split-right",
    });
    expect(keys.mode).toBe("idle");
  });
  it("passes one literal prefix when the prefix is repeated", () => {
    const keys = new PrefixKeys();
    keys.input(key("b", true));
    expect(keys.input(key("b", true))).toEqual({ consumed: false });
    expect(keys.mode).toBe("idle");
  });
  it("consumes prefix key repeat without dispatching twice", () => {
    const keys = new PrefixKeys();
    keys.input(key("b", true));
    expect(keys.input({ ...key("b", true), isAutoRepeat: true })).toEqual({
      consumed: true,
    });
    expect(keys.mode).toBe("prefix");
  });
  it("distinguishes swap and focus bindings", () => {
    const keys = new PrefixKeys();
    keys.input(key("b", true));
    expect(keys.input(key("H", false, true))).toEqual({
      consumed: true,
      command: "swap-left",
    });
  });
  it("preserves the prefix while modifier keys are pressed", () => {
    const keys = new PrefixKeys();
    keys.input(key("b", true));
    expect(keys.input(key("Shift", false, true))).toEqual({ consumed: true });
    expect(keys.mode).toBe("prefix");
    expect(keys.input(key("J", false, true))).toEqual({
      consumed: true,
      command: "swap-down",
    });
    keys.input(key("b", true));
    keys.input(key("Control", true));
    expect(keys.input(key("b", true))).toEqual({ consumed: false });
  });
  it("leaves resize mode on Escape and restores client input", () => {
    const keys = new PrefixKeys();
    keys.input(key("b", true));
    keys.input(key("r"));
    expect(keys.input(key("l"))).toEqual({
      consumed: true,
      command: "resize-right",
    });
    expect(keys.input(key("Escape"))).toEqual({ consumed: true });
    expect(keys.input(key("l"))).toEqual({ consumed: false });
  });
});
