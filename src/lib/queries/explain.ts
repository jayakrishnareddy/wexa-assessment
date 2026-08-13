import {
  AFFILIATION_WINDOW_YEARS,
  CO_AUTHOR_WINDOW_YEARS,
  CURRENT_YEAR,
  GRANT_WINDOW_YEARS,
  RULES_BY_ID,
  SECOND_DEGREE_MIN_JOINT_PAPERS,
  SEVERITY_ORDER,
  verdictFor,
} from "../domain";
import { runRead } from "../neo4j";
import type {
  ConflictEvidence,
  ConflictExplanation,
  GraphData,
  GraphEdge,
  GraphNode,
  ResearcherSummary,
} from "../types";

/**
 * Pairwise evidence between one applicant and one candidate reviewer.
 *
 * The screening query answers "who is conflicted"; this answers "show me
 * exactly why", returning the actual papers, grants and posts behind the
 * verdict so the panel sees evidence rather than a verdict it must trust.
 */
const PAIR_EVIDENCE = `
MATCH (applicant:Researcher {id: $applicantId})
MATCH (candidate:Researcher {id: $candidateId})

OPTIONAL MATCH (applicant)-[applicantPost:AFFILIATED_WITH]->(applicantInstitution:Institution)
WHERE applicantPost.toYear IS NULL
OPTIONAL MATCH (candidate)-[candidatePost:AFFILIATED_WITH]->(candidateInstitution:Institution)
WHERE candidatePost.toYear IS NULL
WITH applicant, candidate, applicantInstitution, candidateInstitution

// Each OPTIONAL MATCH below names a fresh variable for the reviewer and pins
// it with "= candidate.id" — a comparison against the already-bound node,
// never against $candidateId directly.
//
// Two CognoDB behaviours make this necessary, both confirmed against a live
// instance (see scripts/check-db.ts, which probes for them):
//
//   1. Naming an already-bound variable inside an OPTIONAL MATCH pattern
//      rebinds it instead of filtering on it. Written the obvious way,
//      OPTIONAL MATCH (applicant)-[:SUPERVISED]->(candidate) returns whoever
//      the applicant supervised and silently overwrites "candidate".
//   2. In a single-hop OPTIONAL MATCH, an id predicate against a parameter --
//      WHERE x.id = $candidateId, or an inline {id: $candidateId} -- is not
//      applied at all. The same predicate against a bound node's property is.
//
// Both produced the same visible symptom: every reviewer came back sharing the
// applicant's supervision record. Parameter predicates on other properties
// (the year windows below) are unaffected, and multi-hop patterns are too, but
// pinning to candidate.id is correct on any engine and costs nothing.
//
// Supervision is matched in each direction separately so the query does not
// depend on startNode(), which is a Neo4j built-in.
OPTIONAL MATCH (applicant)-[applicantSupervised:SUPERVISED]->(supervisee:Researcher)
WHERE supervisee.id = candidate.id
WITH applicant, candidate, applicantInstitution, candidateInstitution,
     collect(DISTINCT {
       kind: applicantSupervised.kind,
       fromYear: applicantSupervised.fromYear,
       toYear: applicantSupervised.toYear,
       supervisorId: applicant.id
     }) AS supervisedByApplicant

OPTIONAL MATCH (applicant)<-[candidateSupervised:SUPERVISED]-(supervisor:Researcher)
WHERE supervisor.id = candidate.id
WITH applicant, candidate, applicantInstitution, candidateInstitution, supervisedByApplicant,
     collect(DISTINCT {
       kind: candidateSupervised.kind,
       fromYear: candidateSupervised.fromYear,
       toYear: candidateSupervised.toYear,
       supervisorId: candidate.id
     }) AS supervisedByCandidate
WITH applicant, candidate, applicantInstitution, candidateInstitution,
     supervisedByApplicant + supervisedByCandidate AS supervisions

OPTIONAL MATCH (applicant)-[:AUTHORED]->(paper:Paper)<-[:AUTHORED]-(coAuthor:Researcher)
WHERE coAuthor.id = candidate.id AND paper.year >= $coAuthorSince
WITH applicant, candidate, applicantInstitution, candidateInstitution, supervisions,
     collect(DISTINCT {id: paper.id, title: paper.title, year: paper.year}) AS papers

OPTIONAL MATCH (applicant)<-[:AWARDED_TO]-(grant:Grant)-[:AWARDED_TO]->(coInvestigator:Researcher)
WHERE coInvestigator.id = candidate.id AND grant.endYear >= $grantSince
WITH applicant, candidate, applicantInstitution, candidateInstitution, supervisions, papers,
     collect(DISTINCT {
       id: grant.id,
       reference: grant.reference,
       title: grant.title,
       startYear: grant.startYear,
       endYear: grant.endYear
     }) AS grants

OPTIONAL MATCH (applicant)-[applicantTenure:AFFILIATED_WITH]->(shared:Institution)
              <-[candidateTenure:AFFILIATED_WITH]-(colleague:Researcher)
WHERE colleague.id = candidate.id
  AND applicantTenure.fromYear <= coalesce(candidateTenure.toYear, $currentYear)
  AND candidateTenure.fromYear <= coalesce(applicantTenure.toYear, $currentYear)
  AND coalesce(applicantTenure.toYear, $currentYear) >= $affiliationSince
  AND coalesce(candidateTenure.toYear, $currentYear) >= $affiliationSince

RETURN applicant.id AS applicantId,
       applicant.name AS applicantName,
       applicant.registryId AS applicantRegistryId,
       applicant.seniority AS applicantSeniority,
       applicant.field AS applicantField,
       applicantInstitution.name AS applicantInstitution,
       applicantInstitution.country AS applicantCountry,
       candidate.id AS candidateId,
       candidate.name AS candidateName,
       candidate.registryId AS candidateRegistryId,
       candidate.seniority AS candidateSeniority,
       candidate.field AS candidateField,
       candidateInstitution.name AS candidateInstitution,
       candidateInstitution.country AS candidateCountry,
       supervisions,
       papers,
       grants,
       collect(DISTINCT {
         id: shared.id,
         name: shared.name,
         fromYear: CASE
           WHEN applicantTenure.fromYear > candidateTenure.fromYear
           THEN applicantTenure.fromYear ELSE candidateTenure.fromYear END,
         toYear: CASE
           WHEN coalesce(applicantTenure.toYear, $currentYear) < coalesce(candidateTenure.toYear, $currentYear)
           THEN coalesce(applicantTenure.toYear, $currentYear)
           ELSE coalesce(candidateTenure.toYear, $currentYear) END
       }) AS institutions
`;

/** Frequent collaborators shared by the pair — the second-degree evidence. */
const PAIR_BRIDGES = `
MATCH (applicant:Researcher {id: $applicantId})-[:AUTHORED]->(applicantPaper:Paper)
      <-[:AUTHORED]-(bridge:Researcher)
WHERE applicantPaper.year >= $since AND bridge.id <> $candidateId
WITH bridge, count(DISTINCT applicantPaper) AS jointWithApplicant
WHERE jointWithApplicant >= $minJoint

MATCH (bridge)-[:AUTHORED]->(bridgePaper:Paper)<-[:AUTHORED]-(candidate:Researcher {id: $candidateId})
WHERE bridgePaper.year >= $since
WITH bridge, jointWithApplicant, count(DISTINCT bridgePaper) AS jointWithCandidate
WHERE jointWithCandidate >= $minJoint

RETURN bridge.id AS id,
       bridge.name AS name,
       bridge.seniority AS seniority,
       jointWithApplicant,
       jointWithCandidate
ORDER BY jointWithApplicant + jointWithCandidate DESC
LIMIT 8
`;

interface PairRow {
  applicantId: string;
  applicantName: string;
  applicantRegistryId: string;
  applicantSeniority: string;
  applicantField: string;
  applicantInstitution: string | null;
  applicantCountry: string | null;
  candidateId: string;
  candidateName: string;
  candidateRegistryId: string;
  candidateSeniority: string;
  candidateField: string;
  candidateInstitution: string | null;
  candidateCountry: string | null;
  supervisions: Array<{
    kind: string;
    fromYear: number;
    toYear: number;
    supervisorId: string;
  }>;
  papers: Array<{ id: string; title: string; year: number }>;
  grants: Array<{
    id: string;
    reference: string;
    title: string;
    startYear: number;
    endYear: number;
  }>;
  institutions: Array<{
    id: string;
    name: string;
    fromYear: number;
    toYear: number;
  }>;
}

interface BridgeRow {
  id: string;
  name: string;
  seniority: string;
  jointWithApplicant: number;
  jointWithCandidate: number;
}

/** `collect(DISTINCT {...})` emits one all-null map when nothing matched. */
function present<T extends { id?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((row) => row && row.id != null);
}

export async function explainPair(
  applicantId: string,
  candidateId: string,
): Promise<ConflictExplanation | null> {
  const [rows, bridges] = await Promise.all([
    runRead<PairRow>(PAIR_EVIDENCE, {
      applicantId,
      candidateId,
      coAuthorSince: CURRENT_YEAR - CO_AUTHOR_WINDOW_YEARS,
      grantSince: CURRENT_YEAR - GRANT_WINDOW_YEARS,
      affiliationSince: CURRENT_YEAR - AFFILIATION_WINDOW_YEARS,
      currentYear: CURRENT_YEAR,
    }),
    runRead<BridgeRow>(PAIR_BRIDGES, {
      applicantId,
      candidateId,
      since: CURRENT_YEAR - CO_AUTHOR_WINDOW_YEARS,
      minJoint: SECOND_DEGREE_MIN_JOINT_PAPERS,
    }),
  ]);

  if (rows.length === 0) return null;
  const row = rows[0];

  const applicant: ResearcherSummary = {
    id: row.applicantId,
    name: row.applicantName,
    registryId: row.applicantRegistryId,
    seniority: row.applicantSeniority,
    field: row.applicantField,
    institution: row.applicantInstitution,
    country: row.applicantCountry,
  };
  const candidate: ResearcherSummary = {
    id: row.candidateId,
    name: row.candidateName,
    registryId: row.candidateRegistryId,
    seniority: row.candidateSeniority,
    field: row.candidateField,
    institution: row.candidateInstitution,
    country: row.candidateCountry,
  };

  const papers = present(row.papers);
  const grants = present(row.grants);
  const institutions = present(row.institutions);
  const supervisions = row.supervisions.filter((item) => item && item.kind != null);

  const conflicts: ConflictEvidence[] = [];
  const withApplicant = {
    withApplicantId: applicant.id,
    withApplicantName: applicant.name,
  };

  if (supervisions.length > 0) {
    const first = supervisions[0];
    const direction =
      first.supervisorId === applicant.id
        ? `${applicant.name} supervised ${candidate.name}`
        : `${candidate.name} supervised ${applicant.name}`;
    conflicts.push({
      ruleId: "supervision",
      severity: RULES_BY_ID.supervision.severity,
      label: RULES_BY_ID.supervision.label,
      detail: `${direction} (${first.kind.toLowerCase()}, ${first.fromYear}–${first.toYear})`,
      examples: supervisions.map(
        (item) => `${item.kind} supervision, ${item.fromYear}–${item.toYear}`,
      ),
      ...withApplicant,
    });
  }

  if (papers.length > 0) {
    const mostRecent = Math.max(...papers.map((paper) => paper.year));
    conflicts.push({
      ruleId: "co-author",
      severity: RULES_BY_ID["co-author"].severity,
      label: RULES_BY_ID["co-author"].label,
      detail:
        papers.length === 1
          ? `1 joint paper (${mostRecent})`
          : `${papers.length} joint papers, most recent ${mostRecent}`,
      examples: [...papers]
        .sort((a, b) => b.year - a.year)
        .map((paper) => `“${paper.title}” (${paper.year})`),
      ...withApplicant,
    });
  }

  if (grants.length > 0) {
    conflicts.push({
      ruleId: "co-investigator",
      severity: RULES_BY_ID["co-investigator"].severity,
      label: RULES_BY_ID["co-investigator"].label,
      detail:
        grants.length === 1
          ? `Joint award ${grants[0].reference}`
          : `${grants.length} joint awards`,
      examples: grants.map(
        (grant) => `${grant.reference} — “${grant.title}” (${grant.startYear}–${grant.endYear})`,
      ),
      ...withApplicant,
    });
  }

  if (institutions.length > 0) {
    const first = institutions[0];
    conflicts.push({
      ruleId: "shared-institution",
      severity: RULES_BY_ID["shared-institution"].severity,
      label: RULES_BY_ID["shared-institution"].label,
      detail: `${first.name}, overlapping ${first.fromYear}–${first.toYear}`,
      examples: institutions.map(
        (item) => `${item.name}, both present ${item.fromYear}–${item.toYear}`,
      ),
      ...withApplicant,
    });
  }

  if (conflicts.length === 0 && bridges.length > 0) {
    conflicts.push({
      ruleId: "second-degree",
      severity: RULES_BY_ID["second-degree"].severity,
      label: RULES_BY_ID["second-degree"].label,
      detail:
        bridges.length === 1
          ? `Both work closely with ${bridges[0].name}`
          : `${bridges.length} shared frequent collaborators`,
      examples: bridges.map(
        (bridge) =>
          `${bridge.name} — ${bridge.jointWithApplicant} papers with ${applicant.name}, ` +
          `${bridge.jointWithCandidate} with ${candidate.name}`,
      ),
      ...withApplicant,
    });
  }

  conflicts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const graph = buildGraph({
    applicant,
    candidate,
    papers,
    grants,
    institutions,
    supervisions,
    // Only draw bridges when they are the reason for the verdict, so the
    // diagram shows the evidence rather than every incidental connection.
    bridges: conflicts.some((conflict) => conflict.ruleId === "second-degree")
      ? bridges
      : [],
  });

  return {
    applicant,
    candidate,
    verdict: verdictFor(conflicts.map((conflict) => conflict.severity)),
    conflicts,
    graph,
  };
}

function buildGraph(input: {
  applicant: ResearcherSummary;
  candidate: ResearcherSummary;
  papers: PairRow["papers"];
  grants: PairRow["grants"];
  institutions: PairRow["institutions"];
  supervisions: PairRow["supervisions"];
  bridges: BridgeRow[];
}): GraphData {
  const { applicant, candidate, papers, grants, institutions, supervisions, bridges } =
    input;

  const nodes: GraphNode[] = [
    {
      id: applicant.id,
      label: applicant.name,
      type: "Researcher",
      sublabel: applicant.institution ?? applicant.seniority,
      role: "applicant",
    },
    {
      id: candidate.id,
      label: candidate.name,
      type: "Researcher",
      sublabel: candidate.institution ?? candidate.seniority,
      role: "candidate",
    },
  ];
  const edges: GraphEdge[] = [];

  for (const supervision of supervisions) {
    const supervisorIsApplicant = supervision.supervisorId === applicant.id;
    edges.push({
      id: `sup-${applicant.id}-${candidate.id}`,
      source: supervisorIsApplicant ? applicant.id : candidate.id,
      target: supervisorIsApplicant ? candidate.id : applicant.id,
      type: "SUPERVISED",
      label: `${supervision.kind} ${supervision.fromYear}–${supervision.toYear}`,
    });
  }

  for (const paper of papers) {
    nodes.push({
      id: paper.id,
      label: paper.title,
      type: "Paper",
      sublabel: String(paper.year),
    });
    edges.push({
      id: `auth-${applicant.id}-${paper.id}`,
      source: applicant.id,
      target: paper.id,
      type: "AUTHORED",
    });
    edges.push({
      id: `auth-${candidate.id}-${paper.id}`,
      source: candidate.id,
      target: paper.id,
      type: "AUTHORED",
    });
  }

  for (const grant of grants) {
    nodes.push({
      id: grant.id,
      label: grant.reference,
      type: "Grant",
      sublabel: `${grant.startYear}–${grant.endYear}`,
    });
    edges.push({
      id: `award-${grant.id}-${applicant.id}`,
      source: grant.id,
      target: applicant.id,
      type: "AWARDED_TO",
    });
    edges.push({
      id: `award-${grant.id}-${candidate.id}`,
      source: grant.id,
      target: candidate.id,
      type: "AWARDED_TO",
    });
  }

  for (const institution of institutions) {
    nodes.push({
      id: institution.id,
      label: institution.name,
      type: "Institution",
      sublabel: `overlap ${institution.fromYear}–${institution.toYear}`,
    });
    edges.push({
      id: `aff-${applicant.id}-${institution.id}`,
      source: applicant.id,
      target: institution.id,
      type: "AFFILIATED_WITH",
    });
    edges.push({
      id: `aff-${candidate.id}-${institution.id}`,
      source: candidate.id,
      target: institution.id,
      type: "AFFILIATED_WITH",
    });
  }

  for (const bridge of bridges) {
    nodes.push({
      id: bridge.id,
      label: bridge.name,
      type: "Researcher",
      sublabel: bridge.seniority,
      role: "bridge",
    });
    edges.push({
      id: `bridge-${applicant.id}-${bridge.id}`,
      source: applicant.id,
      target: bridge.id,
      type: "CO_AUTHOR",
      label: `${bridge.jointWithApplicant} papers`,
    });
    edges.push({
      id: `bridge-${bridge.id}-${candidate.id}`,
      source: bridge.id,
      target: candidate.id,
      type: "CO_AUTHOR",
      label: `${bridge.jointWithCandidate} papers`,
    });
  }

  return { nodes, edges };
}
