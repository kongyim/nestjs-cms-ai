"use client";
import { useData } from "../hooks/use-data";
import type { Job } from "../lib/types";
import { Frame } from "../components/frame";
import { ErrorBox } from "../components/error-box";
import { Badge } from "../components/badge";

export function Dashboard() {
  const { data, error, loading } = useData<{
    knowledgeBases: number;
    documents: { status: string; count: number }[];
    chats: number;
    jobs: Job[];
    usage: {
      metadata: { usage?: { inputTokens?: number; outputTokens?: number } };
    }[];
  }>(
    "/dashboard",
    { knowledgeBases: 0, documents: [], chats: 0, jobs: [], usage: [] },
    5000,
  );
  return (
    <Frame
      title="Your knowledge, connected"
      description="Turn source documents into searchable, cited answers."
    >
      <ErrorBox message={error} />
      <div className="hero">
        <div className="eyebrow">From documents to evidence</div>
        <h2>A clear path from source to answer</h2>
        <p>
          Upload your knowledge, inspect what retrieval finds, and ask questions
          grounded in those sources. Every answer starts with an access check.
        </p>
        <Badge status={loading ? "Loading workspace" : "Workspace overview"} />
      </div>
      <div className="grid">
        {[
          ["Knowledge bases", data.knowledgeBases],
          [
            "Indexed documents",
            data.documents.find((d) => d.status === "ready")?.count ?? 0,
          ],
          [
            "Failed jobs",
            data.jobs.filter((j) => j.status === "failed").length,
          ],
          ["Your conversations", data.chats],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <div className="muted">{label}</div>
            <div className="stat">{value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Ingestion activity</h2>
        {data.documents.length ? (
          <div className="row">
            {data.documents.map((d) => (
              <span key={d.status}>
                <Badge status={d.status} /> {d.count}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">
            Create a knowledge base and upload your first document to get
            started.
          </p>
        )}
        <p className="muted">
          Reported tokens in your last 100 answers:{" "}
          {data.usage.reduce(
            (n, u) =>
              n +
              (u.metadata.usage?.inputTokens ?? 0) +
              (u.metadata.usage?.outputTokens ?? 0),
            0,
          )}
          . Mock responses do not report token usage.
        </p>
      </div>
    </Frame>
  );
}
