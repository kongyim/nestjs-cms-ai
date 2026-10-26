export type KB = {
  id: string;
  name: string;
  description: string;
  visibility: string;
};
export type Doc = {
  id: string;
  filename: string;
  status: string;
  size: number;
  version: number;
  errorMessage?: string;
};
export type Source = {
  label: number;
  documentId: string;
  chunkId: string;
  filename: string;
  preview: string;
  metadata?: { page?: number; heading?: string; version?: number };
};
export type ChatMessage = {
  role: string;
  content: string;
  citations?: Source[];
};
export type Session = {
  id: string;
  title: string;
  knowledgeBaseId: string;
  messages?: ChatMessage[];
};
export type Hit = {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  semanticScore?: number;
  keywordScore?: number;
  fusionScore?: number;
};
export type Job = {
  id: string;
  filename: string;
  status: string;
  attempts: number;
  errorMessage?: string;
};
export type EvalCase = {
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
export type Run = {
  id: string;
  status: string;
  createdAt: string;
  summary: { recallAtK?: number; mrr?: number };
  results: EvalCase[];
  config: { topK: number; hybrid: boolean };
};
