"use client";
import type { Source } from "../lib/types";

export function SourceCards({ sources }: { sources: Source[] }) {
  return (
    <div className="sources">
      {sources.map((s) => (
        <details className="source" key={s.chunkId}>
          <summary>
            [{s.label}] {s.filename}
          </summary>
          <p className="muted">
            {s.metadata?.page
              ? `Page ${s.metadata.page}`
              : (s.metadata?.heading ?? "Source excerpt")}
          </p>
          <p>{s.preview}</p>
          <a href={`/api/documents/${s.documentId}/download`}>
            Download source
          </a>
        </details>
      ))}
    </div>
  );
}
