import {
  cliLabels,
  type ModelMappings,
  providerLabels,
  providers,
} from "../../../shared/model-mappings";
import { providerSchema } from "../../../shared/proxy";

export function MappingRoutes({
  routes,
  onChange,
}: {
  readonly routes: ModelMappings["routes"];
  readonly onChange: (routes: ModelMappings["routes"]) => void;
}) {
  return (
    <div className="mapping-routes">
      {providers.map((cli) => (
        <label className="field" key={cli}>
          {cliLabels[cli]} 실행 제공자
          <select
            aria-label={`${cliLabels[cli]} 실행 제공자`}
            value={routes[cli] ?? ""}
            onChange={(event) =>
              onChange({
                ...routes,
                [cli]: event.target.value
                  ? providerSchema.parse(event.target.value)
                  : null,
              })
            }
          >
            <option value="">모델 직접 선택</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {providerLabels[provider]}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
