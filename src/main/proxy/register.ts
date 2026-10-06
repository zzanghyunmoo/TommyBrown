import { z } from "zod";
import type { ModelService } from "../models";
import type { LaunchSettingsStore } from "./launch-settings";

export function registerModels(
  models: ModelService,
  settings: LaunchSettingsStore,
  bind: (channel: string, action: (input: unknown) => unknown) => void,
) {
  bind("models:snapshot", () => models.snapshot());
  bind("models:launch-settings", () => settings.snapshot());
  bind("models:save-launch-selection", (input) => settings.save(input));
  bind("models:install", () => models.install());
  bind("models:start", () =>
    models.start(process.env["TOMMYBROWN_TEST"] === "1" ? 0 : 8317),
  );
  bind("models:stop", () => models.stop());
  bind("models:login", (input) => models.login(input));
  bind("models:login-status", (input) =>
    models.loginStatus(z.string().min(1).parse(input)),
  );
  bind("models:cancel-login", (input) =>
    models.cancelLogin(z.string().min(1).parse(input)),
  );
  bind("models:reopen-login", (input) =>
    models.reopenLogin(z.string().min(1).parse(input)),
  );
  bind("models:copy-launch", (input) => models.copyLaunch(input));
  bind("models:save-mappings", (input) => models.saveMappings(input));
}
