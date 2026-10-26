"use client";
import { useData } from "../hooks/use-data";
import type { Job } from "../lib/types";
import { Frame } from "../components/frame";
import { ErrorBox } from "../components/error-box";
import { Badge } from "../components/badge";

export function Jobs() {
  const { data, error } = useData<Job[]>("/ingestion-jobs", [], 2500);
  return (
    <Frame
      title="Ingestion jobs"
      description="Follow extraction, embedding and indexing. Failed jobs can be recovered by reindexing the document."
    >
      <ErrorBox message={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Document / Job</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {data.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.filename}
                  <div className="muted">{j.id}</div>
                </td>
                <td>
                  <Badge status={j.status} />
                </td>
                <td>{j.attempts}</td>
                <td>{j.errorMessage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && <p className="empty">No ingestion jobs yet.</p>}
      </div>
    </Frame>
  );
}
