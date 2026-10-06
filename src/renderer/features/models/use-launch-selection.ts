import { useEffect, useSyncExternalStore } from "react";
import {
  cliSchema,
  type LaunchSettings,
} from "../../../shared/launch-settings";

type SelectionState = {
  readonly settings?: LaunchSettings;
  readonly busy: boolean;
  readonly error?: string;
};
let state: SelectionState = { busy: true };
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
function publish(next: SelectionState) {
  state = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const snapshot = () => state;
function load() {
  loading ??= window.desktop
    .launchSettings()
    .then((settings) => {
      publish({ settings, busy: false });
    })
    .catch((failure: unknown) => {
      publish({
        busy: false,
        error:
          failure instanceof Error
            ? failure.message
            : "CLI 설정을 읽지 못했습니다.",
      });
    });
  return loading;
}
async function select(nextCli: string, nextModel?: string): Promise<boolean> {
  const { settings, busy } = state;
  if (!settings || busy) return false;
  const cli = cliSchema.parse(nextCli);
  const model =
    cli === "powershell"
      ? null
      : nextModel === undefined
        ? settings.models[cli]
        : nextModel || null;
  publish({ settings, busy: true });
  try {
    publish({
      settings: await window.desktop.saveLaunchSelection({ cli, model }),
      busy: false,
    });
    return true;
  } catch (failure) {
    publish({
      settings,
      busy: false,
      error:
        failure instanceof Error
          ? failure.message
          : "CLI 설정을 저장하지 못했습니다.",
    });
    return false;
  }
}
export function useLaunchSelection(allowShell: boolean) {
  const current = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    void load();
  }, []);
  const cli =
    current.settings?.cli === "powershell" && !allowShell
      ? "claude"
      : (current.settings?.cli ?? (allowShell ? "powershell" : "claude"));
  const model =
    cli === "powershell" ? "" : (current.settings?.models[cli] ?? "");
  return {
    cli,
    model,
    select,
    busy: current.busy || !current.settings,
    error: current.error,
  };
}
