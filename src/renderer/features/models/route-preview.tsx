import type { ModelMappings } from "../../../shared/model-mappings";
import { providerLabels, resolveMapping } from "../../../shared/model-mappings";
import type { Provider } from "../../../shared/proxy";

export function RoutePreview({
  settings,
  cli,
  model,
}: {
  readonly settings: ModelMappings;
  readonly cli: Provider;
  readonly model: string;
}) {
  if (!model) return null;
  try {
    const target = resolveMapping(settings, cli, model);
    return target ? (
      <p className="route-preview" role="status">
        {model} → <strong>{providerLabels[target.provider]}</strong> /{" "}
        <code>{target.model}</code>
      </p>
    ) : null;
  } catch (error) {
    return (
      <p className="route-preview error" role="alert">
        {error instanceof Error ? error.message : "매핑을 확인해 주세요."}
      </p>
    );
  }
}
