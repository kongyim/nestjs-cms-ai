"use client";
import { useState } from "react";
import { api } from "../lib/api";
import { useData } from "../hooks/use-data";
import type { KB, Hit } from "../lib/types";
import { Frame } from "../components/frame";
import { ErrorBox } from "../components/error-box";
import { KBSelect } from "../components/knowledge-base-select";
import { Badge } from "../components/badge";

export function Search() {
  const { data: bases, error } = useData<KB[]>("/knowledge-bases", []);
  const [kb, setKB] = useState(""),
    [query, setQuery] = useState(""),
    [hybrid, setHybrid] = useState(true),
    [topK, setTopK] = useState(6),
    [hits, setHits] = useState<Hit[]>([]),
    [latency, setLatency] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function search() {
    setBusy(true);
    setMessage("");
    try {
      const r = await api<{ hits: Hit[]; latencyMs: number }>("/search", {
        knowledgeBaseId: kb,
        query,
        hybrid,
        topK,
      });
      setHits(r.hits);
      setLatency(r.latencyMs);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame
      title="Search explorer"
      description="Inspect the evidence before it reaches the language model."
    >
      <ErrorBox message={error || message} />
      <div className="card">
        <KBSelect bases={bases} value={kb} onChange={setKB} />
        <label>
          Query
          <input
            value={query}
            maxLength={4000}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="How long do international deliveries take?"
          />
        </label>
        <div className="row form-toolbar">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={hybrid}
              onChange={(e) => setHybrid(e.target.checked)}
            />{" "}
            Hybrid retrieval
          </label>
          <label className="compact-field">
            Top K{" "}
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            >
              {[3, 6, 10, 20].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={!kb || !query.trim() || busy}
            onClick={() => void search()}
          >
            {busy ? "Searching…" : "Search knowledge"}
          </button>
        </div>
      </div>
      {latency !== null && (
        <p className="muted">
          {hits.length} chunks · {latency.toFixed(0)} ms. Cosine similarity,
          PostgreSQL text rank and RRF are different scales.
        </p>
      )}
      {hits.map((h, i) => (
        <article className="card" key={h.id} style={{ marginTop: 14 }}>
          <div className="row space">
            <h2>
              {i + 1}. {h.filename}
            </h2>
            <a href={`/api/documents/${h.documentId}/download`}>Source</a>
          </div>
          <div className="row">
            <Badge
              status={`Cosine: ${h.semanticScore?.toFixed(4) ?? "not in candidate list"}`}
            />
            <Badge
              status={`Text rank: ${h.keywordScore?.toFixed(4) ?? "not in candidate list"}`}
            />
            {h.fusionScore !== undefined && (
              <Badge status={`RRF: ${h.fusionScore.toFixed(5)}`} />
            )}
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{h.content}</p>
        </article>
      ))}
    </Frame>
  );
}
