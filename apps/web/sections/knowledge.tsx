"use client";
import { useState } from "react";
import { api } from "../lib/api";
import { useData } from "../hooks/use-data";
import type { KB } from "../lib/types";
import { Frame } from "../components/frame";
import { ErrorBox } from "../components/error-box";
import { Badge } from "../components/badge";
import { Documents } from "../components/document-management";

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
