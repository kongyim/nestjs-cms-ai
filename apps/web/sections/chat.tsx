"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useData } from "../hooks/use-data";
import type { KB, Session, ChatMessage, Source } from "../lib/types";
import { Frame } from "../components/frame";
import { ErrorBox } from "../components/error-box";
import { KBSelect } from "../components/knowledge-base-select";
import { SourceCards } from "../components/source-cards";

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
