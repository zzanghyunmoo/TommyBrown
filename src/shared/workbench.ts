import { z } from "zod";

export const shortcuts = [
  { key: "c", command: "new-tab", label: "새 탭 / 세션" },
  { key: "v", command: "split-right", label: "오른쪽에 터미널 분할" },
  { key: "-", command: "split-down", label: "아래에 터미널 분할" },
  { key: "h", command: "focus-left", label: "왼쪽 패널로 이동" },
  { key: "j", command: "focus-down", label: "아래 패널로 이동" },
  { key: "k", command: "focus-up", label: "위 패널로 이동" },
  { key: "l", command: "focus-right", label: "오른쪽 패널로 이동" },
  { key: "H", command: "swap-left", label: "왼쪽 패널과 교체" },
  { key: "J", command: "swap-down", label: "아래 패널과 교체" },
  { key: "K", command: "swap-up", label: "위 패널과 교체" },
  { key: "L", command: "swap-right", label: "오른쪽 패널과 교체" },
  { key: "z", command: "zoom", label: "현재 패널 확대 / 복원" },
  { key: "r", command: "resize", label: "크기 조절 모드" },
  { key: "x", command: "close-pane", label: "현재 패널 닫기" },
  { key: "X", command: "close-tab", label: "현재 탭 / 세션 닫기" },
  { key: "n", command: "next-tab", label: "다음 탭" },
  { key: "p", command: "previous-tab", label: "이전 탭" },
  { key: "1", command: "tab-1", label: "1번 탭" },
  { key: "2", command: "tab-2", label: "2번 탭" },
  { key: "3", command: "tab-3", label: "3번 탭" },
  { key: "4", command: "tab-4", label: "4번 탭" },
  { key: "5", command: "tab-5", label: "5번 탭" },
  { key: "6", command: "tab-6", label: "6번 탭" },
  { key: "7", command: "tab-7", label: "7번 탭" },
  { key: "8", command: "tab-8", label: "8번 탭" },
  { key: "9", command: "tab-9", label: "9번 탭" },
  { key: "b", command: "sidebar", label: "사이드바 표시 / 숨김" },
  { key: "w", command: "workspaces", label: "공간 탐색" },
  { key: "g", command: "sessions", label: "세션 탐색" },
  { key: "N", command: "new-workspace", label: "새 공간 열기" },
  { key: "?", command: "help", label: "단축키 도움말" },
] as const;

export const workbenchCommandSchema = z.enum([
  ...shortcuts.map((item) => item.command),
  "resize-left",
  "resize-down",
  "resize-up",
  "resize-right",
]);
export type WorkbenchCommand = z.infer<typeof workbenchCommandSchema>;
export const workbenchEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command"),
    command: workbenchCommandSchema,
    group: z.string().nullable(),
  }),
  z.object({
    type: z.literal("mode"),
    mode: z.enum(["idle", "prefix", "resize"]),
  }),
  z.object({ type: z.literal("focus"), group: z.string() }),
]);
export type WorkbenchEvent = z.infer<typeof workbenchEventSchema>;
export interface WorkbenchBridge {
  readonly enable: (enabled: boolean) => Promise<void>;
  readonly reset: () => Promise<void>;
  readonly onEvent: (callback: (event: WorkbenchEvent) => void) => () => void;
}
declare global {
  interface Window {
    readonly workbench: WorkbenchBridge;
  }
}
