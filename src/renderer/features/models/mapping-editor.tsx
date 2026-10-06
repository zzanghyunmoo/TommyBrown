import { useState } from "react";
import {
  claudeShortcuts,
  type ModelMapping,
  type ModelMappings,
  modelMappingsSchema,
  type ProviderModels,
  providerLabels,
  providers,
} from "../../../shared/model-mappings";
import { addPurposeMappings } from "../../../shared/model-presets";
import { Button, Notice, Panel } from "../../components/primitives";
import { MappingRoutes } from "./mapping-routes";

export function MappingEditor({
  saved,
  catalog,
  busy,
  run,
}: {
  readonly saved: ModelMappings;
  readonly catalog: ProviderModels;
  readonly busy: boolean;
  readonly run: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string>();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  function update(id: string, change: (row: ModelMapping) => ModelMapping) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === id ? change(row) : row)),
    }));
    setError(undefined);
  }
  return (
    <Panel
      title="모델 매핑"
      description="심층 추론, 복잡한 코딩, 일반 코딩, 빠른 작업에 맞춰 모델을 연결하세요."
      action={<span className="count">{dirty ? "저장 전" : "저장됨"}</span>}
    >
      <fieldset
        className="mapping-editor"
        aria-label="모델 매핑 편집"
        disabled={busy}
      >
        <MappingRoutes
          routes={draft.routes}
          onChange={(routes) => setDraft((current) => ({ ...current, routes }))}
        />
        <p className="mapping-help">
          모델 ID는 계정의 목록에서 선택하거나 입력하세요. 실행 제공자의 모델은
          연결된 계정에서 사용할 수 있어야 합니다.
        </p>
        {providers.map((provider) => (
          <datalist id={`mapping-models-${provider}`} key={provider}>
            {catalog[provider]
              .filter((id) => !id.startsWith("tb-"))
              .map((id) => (
                <option key={id} value={id} />
              ))}
          </datalist>
        ))}
        {draft.rows.length ? (
          <div className="mapping-scroll">
            <table className="mapping-table">
              <thead>
                <tr>
                  <th scope="col">용도 / 연결 이름</th>
                  {providers.map((provider) => (
                    <th scope="col" key={provider}>
                      {providerLabels[provider]}
                    </th>
                  ))}
                  <th scope="col">삭제</th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label={`매핑 이름 ${index + 1}`}
                        maxLength={80}
                        value={row.name}
                        onChange={(event) =>
                          update(row.id, (current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </td>
                    {providers.map((provider) => (
                      <td key={provider}>
                        <input
                          aria-label={`${providerLabels[provider]} 모델 ${index + 1}`}
                          list={`mapping-models-${provider}`}
                          maxLength={200}
                          placeholder="모델 ID"
                          title={row.models[provider] ?? "모델 ID"}
                          value={row.models[provider] ?? ""}
                          onChange={(event) =>
                            update(row.id, (current) => ({
                              ...current,
                              models: {
                                ...current.models,
                                [provider]: event.target.value.trim() || null,
                              },
                            }))
                          }
                        />
                        {row.models[provider] &&
                          !catalog[provider].includes(row.models[provider]) && (
                            <small className="mapping-help">
                              요청 별칭 · 이 계정에서 실행 불가
                            </small>
                          )}
                        {provider === "claude" && (
                          <select
                            aria-label={`Claude 단축 이름 ${index + 1}`}
                            value={row.claudeShortcut ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              const shortcut =
                                claudeShortcuts.find(
                                  (candidate) => candidate === value,
                                ) ?? null;
                              update(row.id, (current) => ({
                                ...current,
                                claudeShortcut: shortcut,
                              }));
                            }}
                          >
                            <option value="">단축 이름 연결 안 함</option>
                            {claudeShortcuts.map((shortcut) => (
                              <option key={shortcut} value={shortcut}>
                                {shortcut}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    ))}
                    <td>
                      <Button
                        tone="quiet"
                        aria-label={`매핑 ${index + 1} 삭제`}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            rows: current.rows.filter(
                              (candidate) => candidate.id !== row.id,
                            ),
                          }))
                        }
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mapping-empty">
            아직 연결한 모델이 없습니다. 용도별 기본 매핑을 추가하거나 새 행을
            만드세요.
          </div>
        )}
        <div className="mapping-actions">
          <Button
            disabled={draft.rows.length >= 64}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                rows: [
                  ...current.rows,
                  {
                    id: crypto.randomUUID(),
                    name: "새 매핑",
                    models: { codex: null, claude: null, antigravity: null },
                    claudeShortcut: null,
                  },
                ],
              }))
            }
          >
            매핑 추가
          </Button>
          <Button
            onClick={() => {
              setDraft((current) => addPurposeMappings(current, catalog));
              setError(undefined);
            }}
          >
            용도별 기본 매핑
          </Button>
          <div className="mapping-save">
            <Button
              disabled={!dirty}
              onClick={() => {
                setDraft(saved);
                setError(undefined);
              }}
            >
              변경 취소
            </Button>
            <Button
              tone="primary"
              disabled={!dirty}
              onClick={() => {
                const parsed = modelMappingsSchema.safeParse(draft);
                if (!parsed.success) {
                  setError(
                    parsed.error.issues[0]?.message ?? "매핑을 확인해 주세요.",
                  );
                  return;
                }
                setError(undefined);
                void run("mappings", () =>
                  window.desktop.saveMappings(parsed.data),
                );
              }}
            >
              매핑 저장
            </Button>
          </div>
        </div>
        {error && <Notice error>{error}</Notice>}
        <p className="mapping-help">
          기본 매핑은 용도 제안이며 성능이 같다는 뜻은 아닙니다. Gemini는 Pro
          High / Pro / Flash / Flash-Lite 순으로 연결합니다. 계정에 없는 이름은
          다른 제공자로 보내는 요청 별칭이며 실제 실행에는 계정 목록의 모델 ID가
          필요합니다. Flash-Lite는 Antigravity 계정에서 제공되지 않을 수
          있습니다. 기존 설정은 유지하며 빈 칸과 없는 용도만 채웁니다. 저장 후
          실행 중인 CLI는 새 세션으로 열어 주세요.
        </p>
      </fieldset>
    </Panel>
  );
}
