"use client";
import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
type KB = { id: string; name: string; description: string; visibility: string };
type Doc = {
  id: string;
  filename: string;
  status: string;
  size: number;
  version: number;
  errorMessage?: string;
};
type Source = {
  label: number;
  documentId: string;
  chunkId: string;
  filename: string;
  preview: string;
  metadata?: { page?: number; heading?: string; version?: number };
};
type ChatMessage = { role: string; content: string; citations?: Source[] };
type Session = {
  id: string;
  title: string;
  knowledgeBaseId: string;
  messages?: ChatMessage[];
};
type Hit = {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  semanticScore?: number;
  keywordScore?: number;
  fusionScore?: number;
};
type Job = {
  id: string;
  filename: string;
  status: string;
  attempts: number;
  errorMessage?: string;
};
type EvalCase = {
  id: string;
  question: string;
  expectedAnswer: string;
  expectedSourceIds: string[];
  retrievedEvidence: { filename: string }[];
  recall: number;
  reciprocalRank: number;
  retrievalMs: number;
  generationMs: number;
  answer: string;
};
type Run = {
  id: string;
  status: string;
  createdAt: string;
  summary: { recallAtK?: number; mrr?: number };
  results: EvalCase[];
  config: { topK: number; hybrid: boolean };
};
async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-cms-request": "1" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.error?.message ?? `Request failed (${response.status})`,
    );
  }
  return response.json();
}
function useData<T>(path: string, initial: T, poll = 0) {
  const [data, setData] = useState<T>(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void refresh();
    if (poll) {
      const timer = setInterval(() => void refresh(), poll);
      return () => clearInterval(timer);
    }
  }, [refresh, poll]);
  return { data, error, loading, refresh };
}
function Frame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="hub">
      <div className="eyebrow">Workspace / {title}</div>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      {children}
    </section>
  );
}
function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null;
}
function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}
function KBSelect({
  bases,
  value,
  onChange,
}: {
  bases: KB[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      Knowledge base{" "}
      <select
        aria-label="Knowledge base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a knowledge base</option>
        {bases.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function SourceCards({ sources }: { sources: Source[] }) {
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
export function Knowledge() {
  const { data: bases, error, refresh } = useData<KB[]>("/knowledge-bases", []);
  const [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState("private"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const kb = await api<KB>("/knowledge-bases", {
        name,
        description,
        visibility,
      });
      setSelected(kb.id);
      setName("");
      await refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  const kb = bases.find((k) => k.id === selected);
  return (
    <Frame
      title="Knowledge bases"
      description="Organise documents into private or team-readable collections."
    >
      <ErrorBox message={error || message} />
      <div className="grid">
        {bases.map((k) => (
          <button
            className="card"
            key={k.id}
            onClick={() => setSelected(k.id)}
            style={{
              textAlign: "left",
              borderColor: selected === k.id ? "#1d645e" : undefined,
            }}
          >
            <h2>{k.name}</h2>
            <p className="muted">{k.description || "No description"}</p>
            <Badge status={k.visibility} />
          </button>
        ))}
      </div>
      <details className="card">
        <summary>Create a knowledge base</summary>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="private">Private — owner and admins</option>
            <option value="shared">
              Shared — all authenticated users can read
            </option>
          </select>
        </label>
        <button
          className="primary"
          disabled={!name.trim() || busy}
          onClick={() => void create()}
        >
          Create knowledge base
        </button>
      </details>
      {kb && <Documents key={kb.id} kb={kb} onChange={refresh} />}
    </Frame>
  );
}
function Documents({
  kb,
  onChange,
}: {
  kb: KB;
  onChange: () => Promise<void>;
}) {
  const {
    data: docs,
    error,
    refresh,
  } = useData<Doc[]>(`/knowledge-bases/${kb.id}/documents`, [], 2500);
  const [message, setMessage] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [editName, setEditName] = useState(kb.name),
    [editDescription, setEditDescription] = useState(kb.description),
    [editVisibility, setEditVisibility] = useState(kb.visibility);
  async function action(path: string, method = "POST") {
    try {
      setMessage("");
      await api(path, undefined, method);
      await refresh();
      await onChange();
    } catch (e) {
      setMessage(String(e));
    }
  }
  function upload(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    form.append("file", files[0]);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/knowledge-bases/${kb.id}/documents`);
    xhr.setRequestHeader("x-cms-request", "1");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 400) setMessage(`Upload failed: ${xhr.responseText}`);
      else {
        setMessage("");
        void refresh();
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setMessage("Upload failed. Check your connection.");
    };
    setProgress(0);
    xhr.send(form);
  }
  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div className="row space">
        <h2>{kb.name} · Documents</h2>
        <button
          className="danger"
          onClick={() => {
            if (
              confirm(
                "Delete this knowledge base and all its documents, chats and evaluations?",
              )
            )
              void action(`/knowledge-bases/${kb.id}`, "DELETE");
          }}
        >
          Delete knowledge base
        </button>
      </div>
      <ErrorBox message={error || message} />
      <details>
        <summary>Edit knowledge base</summary>
        <label>
          Name
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
        </label>
        <label>
          Visibility
          <select
            value={editVisibility}
            onChange={(e) => setEditVisibility(e.target.value)}
          >
            <option value="private">Private</option>
            <option value="shared">Shared</option>
          </select>
        </label>
        <button
          onClick={() =>
            void api(
              `/knowledge-bases/${kb.id}`,
              {
                name: editName,
                description: editDescription,
                visibility: editVisibility,
              },
              "PATCH",
            )
              .then(onChange)
              .catch((e) => setMessage(String(e)))
          }
        >
          Save changes
        </button>
      </details>
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        <h2>Drop a document here</h2>
        <p className="muted">
          TXT, Markdown, text-based PDF or DOCX · up to 10 MB by default
        </p>
        <input
          aria-label="Upload document"
          type="file"
          accept=".txt,.md,.pdf,.docx"
          disabled={progress !== null}
          onChange={(e) => upload(e.target.files)}
        />
        {progress !== null && (
          <>
            <progress value={progress} max={100} />
            <span>{progress}% uploaded</span>
          </>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Version</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <a href={`/api/documents/${d.id}/download`}>{d.filename}</a>
                  <div className="muted">{(d.size / 1024).toFixed(1)} KB</div>
                  {d.errorMessage && (
                    <div className="error">{d.errorMessage}</div>
                  )}
                </td>
                <td>
                  <Badge status={d.status} />
                </td>
                <td>{d.version}</td>
                <td>
                  <div className="row">
                    <button
                      disabled={["queued", "processing"].includes(d.status)}
                      onClick={() => void action(`/documents/${d.id}/reindex`)}
                    >
                      Reindex
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this document? All conversations and evaluations in this knowledge base will also be purged to remove derived content.",
                          )
                        )
                          void action(`/documents/${d.id}`, "DELETE");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!docs.length && (
          <div className="empty">
            No documents yet. Upload a source to begin.
          </div>
        )}
      </div>
    </section>
  );
}
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
        <div className="row">
          <label>
            <input
              type="checkbox"
              checked={hybrid}
              onChange={(e) => setHybrid(e.target.checked)}
            />{" "}
            Hybrid retrieval
          </label>
          <label>
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
export function Chat() {
  const { data: bases, error } = useData<KB[]>("/knowledge-bases", []);
  const { data: sessions, refresh } = useData<Session[]>("/chat/sessions", []);
  const [kb, setKB] = useState(""),
    [session, setSession] = useState<Session | null>(null),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function open(s: Session) {
    try {
      const data = await api<Session>(`/chat/sessions/${s.id}`);
      setSession(data);
      setKB(data.knowledgeBaseId);
      setMessages(data.messages ?? []);
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function send() {
    setBusy(true);
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    let current = session;
    try {
      if (!current) {
        current = await api<Session>("/chat/sessions", {
          knowledgeBaseId: kb,
          title: question.slice(0, 100),
        });
        setSession(current);
      }
      const q = question;
      setQuestion("");
      setMessages((m) => [
        ...m,
        { role: "user", content: q },
        { role: "assistant", content: "" },
      ]);
      const response = await fetch(
        `/api/chat/sessions/${current.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cms-request": "1" },
          body: JSON.stringify({ question: q }),
          signal: controller.signal,
        },
      );
      if (!response.ok || !response.body)
        throw new Error("Could not start generation");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "",
        content = "",
        sources: Source[] = [];
      while (true) {
        const r = await reader.read();
        buffer += r.done
          ? decoder.decode()
          : decoder.decode(r.value, { stream: true });
        let index: number;
        while ((index = buffer.indexOf("\n\n")) >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as {
            type: string;
            text?: string;
            content?: string;
            sources?: Source[];
            message?: string;
          };
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "sources") sources = event.sources ?? [];
          if (event.type === "delta") content += event.text ?? "";
          if (event.type === "done") {
            content = event.content ?? content;
            sources = event.sources ?? sources;
          }
          setMessages((m) => [
            ...m.slice(0, -1),
            { role: "assistant", content, citations: sources },
          ]);
        }
        if (r.done) break;
      }
      await refresh();
    } catch (e) {
      setMessage(
        controller.signal.aborted
          ? "Generation stopped. Partial text is not saved."
          : String(e),
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  return (
    <Frame
      title="AI conversations"
      description="Ask a question, follow the evidence, and inspect the source."
    >
      <ErrorBox message={error || message} />
      <div className="split">
        <aside className="card">
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              setSession(null);
              setMessages([]);
            }}
          >
            New conversation
          </button>
          <h2 style={{ marginTop: 20 }}>History</h2>
          {sessions.map((s) => (
            <button
              className="session"
              disabled={busy}
              key={s.id}
              onClick={() => void open(s)}
            >
              {s.title}
            </button>
          ))}
        </aside>
        <section>
          <div className="card">
            {session ? (
              <h2>{session.title}</h2>
            ) : (
              <KBSelect bases={bases} value={kb} onChange={setKB} />
            )}
            <p className="muted">
              Answers use current retrieved evidence. Stored conversation
              history is available here; prior turns are not sent to the model.
            </p>
          </div>
          <div aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                <div className="eyebrow">
                  {m.role === "user" ? "You" : "Knowledge assistant"}
                </div>
                {m.content || "Retrieving evidence…"}
                {m.citations && <SourceCards sources={m.citations} />}
              </div>
            ))}
          </div>
          {!messages.length && (
            <div className="empty">
              Your next answer starts with a source.
              <br />
              Select a knowledge base and ask a question.
            </div>
          )}
          <div className="card">
            <label>
              Question
              <textarea
                rows={3}
                maxLength={4000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is the return policy?"
              />
            </label>
            <div className="row space">
              <span className="muted">{question.length}/4000</span>
              {busy ? (
                <button onClick={() => abort.current?.abort()}>
                  Stop generation
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={!kb || !question.trim()}
                  onClick={() => void send()}
                >
                  Ask knowledge hub ↗
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </Frame>
  );
}
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
        <div className="row">
          <label>
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
          <label>
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
