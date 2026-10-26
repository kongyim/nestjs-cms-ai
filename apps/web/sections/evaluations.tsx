"use client";
import { useState } from "react";
import { api } from "../lib/api";
import { useData } from "../hooks/use-data";
import type { KB, Run } from "../lib/types";
import { Frame } from "../components/frame";
import { ErrorBox } from "../components/error-box";
import { KBSelect } from "../components/knowledge-base-select";
import { Badge } from "../components/badge";

export function Evaluations() {
  const { data: bases, error } = useData<KB[]>("/knowledge-bases", []);
  const { data: runs, refresh } = useData<Run[]>("/evaluations/runs", [], 5000);
  const [kb, setKB] = useState(""),
    [topK, setTopK] = useState(6),
    [hybrid, setHybrid] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<string>("");
  const run = runs.find((r) => r.id === selected) ?? runs[0];
  async function execute() {
    setBusy(true);
    try {
      const result = await api<Run>("/evaluations/run", {
        knowledgeBaseId: kb,
        topK,
        hybrid,
      });
      setSelected(result.id);
      await refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame
      title="Retrieval evaluations"
      description="Reproducible evidence checks against 20 fictional commerce questions."
    >
      <ErrorBox message={error || message} />
      <div className="card">
        <KBSelect bases={bases} value={kb} onChange={setKB} />
        <p className="muted">
          Use the indexed Northstar demo dataset. Recall and MRR measure
          retrieval, not answer correctness. Mock runs do not establish real
          model quality.
        </p>
        <div className="row form-toolbar">
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
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={hybrid}
              onChange={(e) => setHybrid(e.target.checked)}
            />{" "}
            Hybrid
          </label>
          <button
            className="primary"
            disabled={!kb || busy}
            onClick={() => void execute()}
          >
            {busy ? "Running 20 cases…" : "Run evaluation"}
          </button>
        </div>
      </div>
      <label>
        Historical run
        <select
          value={run?.id ?? ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select run</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {new Date(r.createdAt).toLocaleString()} · {r.status} · K=
              {r.config.topK} · {r.config.hybrid ? "hybrid" : "semantic"}
            </option>
          ))}
        </select>
      </label>
      {run && (
        <>
          <div className="grid">
            <div className="card">
              <h2>Recall@{run.config.topK}</h2>
              <div className="stat">
                {run.summary.recallAtK?.toFixed(3) ?? "—"}
              </div>
            </div>
            <div className="card">
              <h2>MRR</h2>
              <div className="stat">{run.summary.mrr?.toFixed(3) ?? "—"}</div>
            </div>
            <div className="card">
              <h2>Status</h2>
              <Badge status={run.status} />
              <p>{run.results.length} cases recorded</p>
            </div>
          </div>
          {run.results.map((r) => (
            <details className="card" key={r.id} style={{ marginTop: 10 }}>
              <summary>
                {r.question} · Recall {r.recall.toFixed(2)} · RR{" "}
                {r.reciprocalRank.toFixed(2)}
              </summary>
              <p>
                Expected: {r.expectedAnswer} ({r.expectedSourceIds.join(", ")})
              </p>
              <p>
                Retrieved:{" "}
                {r.retrievedEvidence.map((e) => e.filename).join(", ")}
              </p>
              <p>
                Retrieval {r.retrievalMs.toFixed(0)} ms · Generation{" "}
                {r.generationMs.toFixed(0)} ms
              </p>
              <pre>{r.answer}</pre>
            </details>
          ))}
        </>
      )}
    </Frame>
  );
}
