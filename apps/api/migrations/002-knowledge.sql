CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE knowledge_bases (
 id uuid PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', visibility text NOT NULL CHECK(visibility IN ('private','shared')), "ownerId" varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_owner ON knowledge_bases("ownerId");
CREATE TABLE documents (
 id uuid PRIMARY KEY,"knowledgeBaseId" uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,filename text NOT NULL,"mimeType" text NOT NULL,size integer NOT NULL,"storageKey" text NOT NULL UNIQUE,"contentHash" text NOT NULL,status text NOT NULL CHECK(status IN ('queued','processing','ready','failed')),version integer NOT NULL DEFAULT 1,"errorMessage" text,"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),UNIQUE("knowledgeBaseId","contentHash")
);
CREATE TABLE document_chunks (
 id uuid PRIMARY KEY,"documentId" uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,"chunkIndex" integer NOT NULL,content text NOT NULL,"tokenCount" integer NOT NULL,metadata jsonb NOT NULL,embedding vector NOT NULL,"modelFingerprint" text NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now(), search tsvector GENERATED ALWAYS AS (to_tsvector('english',content)) STORED,UNIQUE("documentId","chunkIndex")
);
CREATE INDEX chunks_search ON document_chunks USING gin(search);
CREATE TABLE ingestion_jobs (
 id uuid PRIMARY KEY,"documentId" uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'queued',attempts integer NOT NULL DEFAULT 0,"startedAt" timestamptz,"completedAt" timestamptz,"errorMessage" text,"createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_job ON ingestion_jobs("documentId") WHERE status IN ('queued','processing');
CREATE TABLE chat_sessions (
 id uuid PRIMARY KEY,"knowledgeBaseId" uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,"userId" varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,title text NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_owner ON chat_sessions("userId");
CREATE TABLE chat_messages (
 id uuid PRIMARY KEY,"sessionId" uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,role text NOT NULL CHECK(role IN ('user','assistant')),content text NOT NULL,citations jsonb NOT NULL DEFAULT '[]',metadata jsonb NOT NULL DEFAULT '{}',"createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE evaluation_runs (
 id uuid PRIMARY KEY,"userId" varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,"knowledgeBaseId" uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,status text NOT NULL,config jsonb NOT NULL,results jsonb NOT NULL DEFAULT '[]',summary jsonb NOT NULL DEFAULT '{}',"createdAt" timestamptz NOT NULL DEFAULT now(),"completedAt" timestamptz
);
CREATE TABLE ai_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id),fingerprint text NOT NULL,dimensions integer NOT NULL);
