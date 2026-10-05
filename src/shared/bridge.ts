import type { LaunchRequest } from "./launch";
import type { ModelMappings, ProviderModels } from "./model-mappings";
import type {
  GatewayStatus,
  LoginStatus,
  Provider,
  ProxyAccount,
  ProxyLogin,
  ProxyModel,
} from "./proxy";

export type ModelSnapshot = {
  readonly installed: boolean;
  readonly version: string;
  readonly gateway: GatewayStatus;
  readonly accounts: readonly ProxyAccount[];
  readonly models: readonly ProxyModel[];
  readonly mappings: ModelMappings;
  readonly mappingRevision: string;
  readonly providerModels: ProviderModels;
  readonly login:
    | (ProxyLogin & { readonly provider: Provider; readonly startedAt: number })
    | null;
  readonly loginError: string | null;
};

export interface DesktopBridge {
  readonly snapshot: () => Promise<ModelSnapshot>;
  readonly install: () => Promise<void>;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly login: (provider: Provider) => Promise<ProxyLogin>;
  readonly loginStatus: (state: string) => Promise<LoginStatus>;
  readonly cancelLogin: (state: string) => Promise<void>;
  readonly reopenLogin: (state: string) => Promise<void>;
  readonly copyLaunch: (request: LaunchRequest) => Promise<void>;
  readonly saveMappings: (settings: ModelMappings) => Promise<void>;
}

declare global {
  interface Window {
    readonly desktop: DesktopBridge;
  }
}
