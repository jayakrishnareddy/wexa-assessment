import type { ConflictRuleId, Severity, Verdict } from "./domain";

export interface ResearcherSummary {
  id: string;
  name: string;
  registryId: string;
  seniority: string;
  field: string;
  /** Current affiliation, or `null` if the person has none on record. */
  institution: string | null;
  country: string | null;
}

export interface ProposalSummary {
  id: string;
  reference: string;
  title: string;
  field: string;
  submittedYear: number;
  requestedUsd: number;
  funder: string;
  topics: string[];
  applicants: ResearcherSummary[];
}

export interface ProposalDetail extends ProposalSummary {
  summary: string;
}

/** One reason a candidate is conflicted, with the evidence behind it. */
export interface ConflictEvidence {
  ruleId: ConflictRuleId;
  severity: Severity;
  label: string;
  /** Short human-readable justification, e.g. "3 joint papers since 2022". */
  detail: string;
  /** The specific records supporting the finding, for the drill-down panel. */
  examples: string[];
  /** Which applicant the conflict is with. */
  withApplicantId: string;
  withApplicantName: string;
}

export interface ScreenedReviewer {
  researcher: ResearcherSummary;
  /** Sum of `EXPERT_IN.weight` across the proposal's topics. */
  expertiseScore: number;
  matchedTopics: string[];
  conflicts: ConflictEvidence[];
  verdict: Verdict;
}

export interface ScreeningResult {
  proposal: ProposalDetail;
  reviewers: ScreenedReviewer[];
  counts: Record<Verdict, number>;
}

// ---- Graph rendering ----------------------------------------------------

export type GraphNodeType =
  | "Researcher"
  | "Paper"
  | "Institution"
  | "Grant"
  | "Funder"
  | "Proposal"
  | "Topic";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  sublabel?: string;
  /** Marks the two endpoints of an explained conflict path. */
  role?: "applicant" | "candidate" | "bridge";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Full explanation of why two researchers are (or are not) in conflict. */
export interface ConflictExplanation {
  applicant: ResearcherSummary;
  candidate: ResearcherSummary;
  verdict: Verdict;
  conflicts: ConflictEvidence[];
  graph: GraphData;
}
