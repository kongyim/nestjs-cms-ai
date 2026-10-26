"use client";
import { useState } from "react";
import { api } from "../lib/api";
import { useData } from "../hooks/use-data";
import type { KB, Doc } from "../lib/types";
import { ErrorBox } from "./error-box";
import { Badge } from "./badge";

export function Documents({
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
