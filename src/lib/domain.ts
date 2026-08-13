/**
 * Shared vocabulary for the reviewer-conflict domain.
 *
 * The seed script, the Cypher queries and the UI all import from here so that
 * a rule change lands in exactly one place.
 */

/** The year the dataset is anchored to, so "last 4 years" is reproducible. */
export const CURRENT_YEAR = 2026;

/** Lookback for direct co-authorship, in years. */
export const CO_AUTHOR_WINDOW_YEARS = 4;
/** Lookback for shared grants, in years. */
export const GRANT_WINDOW_YEARS = 5;
/** Lookback for overlapping affiliations, in years. */
export const AFFILIATION_WINDOW_YEARS = 3;

/**
 * How many joint papers an intermediary must share with *each* side before a
 * second-degree link counts as a conflict.
 *
 * This threshold matters more than it looks. Academic co-authorship is a
 * small world: on this dataset, treating *any* shared co-author as a conflict
 * flags 60% of the candidate pool and leaves 16 of 28 proposals with no
 * eligible reviewer at all — the rule is technically correct and practically
 * useless. Requiring the intermediary to be a frequent collaborator of both
 * parties drops the flagged share to 8% and leaves every proposal reviewable.
 */
export const SECOND_DEGREE_MIN_JOINT_PAPERS = 2;

export const NODE_LABELS = [
  "Researcher",
  "Paper",
  "Institution",
  "Funder",
  "Grant",
  "Proposal",
  "Topic",
] as const;

export type NodeLabel = (typeof NODE_LABELS)[number];

export const RELATIONSHIP_TYPES = [
  "AUTHORED",
  "AFFILIATED_WITH",
  "SUPERVISED",
  "AWARDED_TO",
  "FUNDED_BY",
  "SUBMITTED_BY",
  "ABOUT",
  "EXPERT_IN",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/**
 * Conflict severity.
 *
 * `blocking` mirrors the hard exclusions used by real funding bodies (NSF's
 * conflict-of-interest policy, the ERC's independence rules); `caution` is the
 * softer second-degree signal that a panel chair may waive with a note.
 */
export type Severity = "blocking" | "caution";

export type ConflictRuleId =
  | "supervision"
  | "co-author"
  | "co-investigator"
  | "shared-institution"
  | "second-degree";

export interface ConflictRule {
  id: ConflictRuleId;
  label: string;
  severity: Severity;
  /** Shown in the UI next to a flagged reviewer. */
  description: string;
  /** Human-readable statement of the lookback window, for the README and UI. */
  window: string;
}

export const CONFLICT_RULES: readonly ConflictRule[] = [
  {
    id: "supervision",
    label: "Supervisor / supervisee",
    severity: "blocking",
    description:
      "A doctoral or postdoctoral supervision relationship in either direction.",
    window: "Lifetime — never expires",
  },
  {
    id: "co-author",
    label: "Recent co-author",
    severity: "blocking",
    description:
      "Both parties appear as authors on the same paper inside the lookback window.",
    window: `Papers published since ${CURRENT_YEAR - CO_AUTHOR_WINDOW_YEARS}`,
  },
  {
    id: "co-investigator",
    label: "Co-investigator on a grant",
    severity: "blocking",
    description: "Both parties hold, or recently held, an award from the same grant.",
    window: `Grants active since ${CURRENT_YEAR - GRANT_WINDOW_YEARS}`,
  },
  {
    id: "shared-institution",
    label: "Overlapping affiliation",
    severity: "blocking",
    description:
      "Both parties were affiliated with the same institution at the same time.",
    window: `Overlapping tenure since ${CURRENT_YEAR - AFFILIATION_WINDOW_YEARS}`,
  },
  {
    id: "second-degree",
    label: "Shared frequent collaborator",
    severity: "caution",
    description:
      "No direct link, but both parties work repeatedly with the same third researcher.",
    window: `Two or more joint papers with the intermediary on each side, since ${
      CURRENT_YEAR - CO_AUTHOR_WINDOW_YEARS
    }`,
  },
];

export const RULES_BY_ID: Record<ConflictRuleId, ConflictRule> = Object.fromEntries(
  CONFLICT_RULES.map((rule) => [rule.id, rule]),
) as Record<ConflictRuleId, ConflictRule>;

export const SEVERITY_ORDER: Record<Severity, number> = {
  blocking: 0,
  caution: 1,
};

/** Verdict for a candidate reviewer once every rule has been evaluated. */
export type Verdict = "clear" | "caution" | "blocked";

export function verdictFor(severities: readonly Severity[]): Verdict {
  if (severities.includes("blocking")) return "blocked";
  if (severities.includes("caution")) return "caution";
  return "clear";
}
