import { useState } from "react";
import {
  type ConnectorInput,
  connectorInputSchema,
  connectorPresets,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";

export function ConnectorForm({
  add,
  busy,
}: {
  readonly add: (input: ConnectorInput, form: HTMLFormElement) => void;
  readonly busy: boolean;
}) {
  const [kind, setKind] = useState("browser");
  const [error, setError] = useState<string>();
  const preset =
    connectorPresets.find((item) => item.kind === kind) ?? connectorPresets[0];
  return (
    <form
      className="connector-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(undefined);
        try {
          add(
            connectorInputSchema.parse({
              kind,
              name: data.get("name"),
              webUrl: data.get("webUrl"),
              endpoint: null,
              token: null,
            }),
            form,
          );
        } catch (failure) {
          if (failure instanceof Error) setError(failure.message);
        }
      }}
    >
      <label>
        웹 앱 종류
        <select
          aria-label="웹 앱 종류"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          disabled={busy}
        >
          {connectorPresets.map((item) => (
            <option key={item.kind} value={item.kind}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        웹 앱 이름
        <input
          key={`${kind}-name`}
          name="name"
          defaultValue={preset.name}
          required
          maxLength={80}
        />
      </label>
      <label>
        웹 앱 주소
        <input
          key={`${kind}-url`}
          name="webUrl"
          defaultValue={preset.url}
          required
          type="url"
        />
      </label>
      <Button type="submit" busy={busy}>
        웹 앱 추가
      </Button>
      {error && <Notice error>{error}</Notice>}
    </form>
  );
}
