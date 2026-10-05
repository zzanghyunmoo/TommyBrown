import { CopyIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { launchRequestSchema } from "../../../shared/launch";
import type { ProxyModel } from "../../../shared/proxy";
import { Button } from "../../components/primitives";

export function LaunchControls({
  models,
  busy,
  run,
}: {
  readonly models: readonly ProxyModel[];
  readonly busy: boolean;
  readonly run: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [cli, setCli] = useState("claude");
  const [selected, setSelected] = useState("");
  const [copied, setCopied] = useState(false);
  const model = models.some((candidate) => candidate.id === selected)
    ? selected
    : (models[0]?.id ?? "");
  return (
    <div className="launch-controls">
      <div className="launch-fields">
        <label className="field">
          사용할 CLI
          <select
            aria-label="사용할 CLI"
            value={cli}
            onChange={(event) => {
              setCli(event.target.value);
              setCopied(false);
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
            disabled={!models.length}
            onChange={(event) => {
              setSelected(event.target.value);
              setCopied(false);
            }}
          >
            {!models.length && (
              <option value="">계정을 먼저 연결해 주세요</option>
            )}
            {models.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button
        disabled={busy || !model}
        onClick={() => {
          void run("copy", async () => {
            await window.desktop.copyLaunch(
              launchRequestSchema.parse({ cli, model }),
            );
            setCopied(true);
          });
        }}
      >
        <CopyIcon />
        {copied ? "실행 명령 복사됨" : "PowerShell 실행 명령 복사"}
      </Button>
      <p>
        로컬 게이트웨이 키가 포함된 명령을 복사합니다. 현재 PowerShell에서
        실행하면 CLI가 종료된 뒤 이전 환경 설정으로 돌아갑니다.
      </p>
    </div>
  );
}
