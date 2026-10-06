import { CopyIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { launchRequestSchema } from "../../../shared/launch";
import {
  emptyMappings,
  launchModels,
  type ModelMappings,
} from "../../../shared/model-mappings";
import { type ProxyModel, providerSchema } from "../../../shared/proxy";
import { Button, Notice } from "../../components/primitives";
import { RoutePreview } from "./route-preview";
import { useLaunchSelection } from "./use-launch-selection";

export function LaunchControls({
  models,
  mappings = emptyMappings(),
  mappingRevision,
  busy,
  run,
}: {
  readonly models: readonly ProxyModel[];
  readonly mappings?: ModelMappings | undefined;
  readonly mappingRevision?: string | undefined;
  readonly busy: boolean;
  readonly run: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const selection = useLaunchSelection(false);
  const cli = providerSchema.parse(selection.cli);
  const selected = selection.model;
  const [copied, setCopied] = useState<string>();
  const choices = launchModels(
    mappings,
    cli,
    models.filter((candidate) => !candidate.id.startsWith("tb-")),
  );
  const model = selected || choices[0] || "";
  const copyKey = JSON.stringify([cli, model, mappings]);
  return (
    <div className="launch-controls">
      <div className="launch-fields">
        <label className="field">
          사용할 CLI
          <select
            aria-label="사용할 CLI"
            value={cli}
            disabled={selection.busy}
            onChange={(event) => {
              void selection.select(event.target.value);
              setCopied(undefined);
            }}
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="antigravity">Antigravity</option>
          </select>
        </label>
        <label className="field">
          사용할 모델
          <select
            aria-label="사용할 모델"
            value={model}
            disabled={!choices.length || selection.busy}
            onChange={(event) => {
              void selection.select(cli, event.target.value);
              setCopied(undefined);
            }}
          >
            {!choices.length && (
              <option value="">
                {mappings.routes[cli]
                  ? "매핑할 모델을 추가해 주세요"
                  : "계정을 먼저 연결해 주세요"}
              </option>
            )}
            {selected && !choices.includes(selected) && (
              <option value={selected}>{selected} (설정 확인 필요)</option>
            )}
            {choices.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
      </div>
      <RoutePreview settings={mappings} cli={cli} model={model} />
      <Button
        disabled={busy || selection.busy || !choices.includes(model)}
        onClick={() => {
          void run("copy", async () => {
            if (!(await selection.select(cli, model))) return;
            await window.desktop.copyLaunch(
              launchRequestSchema.parse({ cli, model, mappingRevision }),
            );
            setCopied(copyKey);
          });
        }}
      >
        <CopyIcon />
        {copied === copyKey ? "실행 명령 복사됨" : "PowerShell 실행 명령 복사"}
      </Button>
      {selection.error && <Notice error>{selection.error}</Notice>}
      <p>
        로컬 게이트웨이 키가 포함된 명령을 복사합니다. 현재 PowerShell에서
        실행하면 CLI가 종료된 뒤 이전 환경 설정으로 돌아갑니다.
      </p>
    </div>
  );
}
