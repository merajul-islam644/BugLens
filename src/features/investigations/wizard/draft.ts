import type { EvidenceRecord } from "../../evidence/evidenceApi";

export type Draft = {
  checks: string[];
  environmentId: string;
  evidence: EvidenceRecord[];
  problem: string;
  projectId: string;
  title: string;
  url: string;
};

export function emptyDraft(url?: string): Draft {
  return { checks: [], environmentId: "", evidence: [], problem: "", projectId: "", title: "", url: url ?? "" };
}

export const STEP_NAMES = ["Target", "Evidence", "What will be checked", "Review"] as const;
