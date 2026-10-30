"use client";
import { useData } from "../hooks/use-data";
import { Frame } from "./frame";
import { ErrorBox } from "./error-box";

export function Settings() {
  const { data, error } = useData<Record<string, unknown>>("/settings", {});
  return (
    <Frame
      title="Settings"
      description="Active server configuration. Change environment variables and restart services to update settings."
    >
      <ErrorBox message={error} />
      <div className="card">
        <table>
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key}>
                <th>{key}</th>
                <td>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Changing the embedding model or dimensions requires a controlled
          reindex. Provider secrets are never sent to this interface. The mock
          provider is deterministic test infrastructure, not a language model.
        </p>
      </div>
    </Frame>
  );
}
