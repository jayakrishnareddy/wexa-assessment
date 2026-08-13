import {
  AFFILIATION_WINDOW_YEARS,
  CO_AUTHOR_WINDOW_YEARS,
  CURRENT_YEAR,
  GRANT_WINDOW_YEARS,
  RULES_BY_ID,
  SECOND_DEGREE_MIN_JOINT_PAPERS,
  SEVERITY_ORDER,
  verdictFor,
  type Verdict,
} from "../domain";
import { runRead } from "../neo4j";
import type { ConflictEvidence, ScreenedReviewer, ScreeningResult } from "../types";
import { getProposal } from "./proposals";

/**
 * Finds every plausible reviewer for a proposal and evaluates the four
 * blocking conflict rules against all of its applicants in a single pass.
 *
 * The shape is deliberate: start from the proposal's topics to build a
 * candidate pool, then attach conflicts with one `OPTIONAL MATCH` per rule.
 * Each `OPTIONAL MATCH` is an independent left-join over the candidate set, so
 * a candidate with no conflicts survives to the end with empty collections
 * rather than being filtered out — which is exactly the row we care about
 * most, since those are the reviewers who can actually be assigned.
 */
const SCREEN_CANDIDATES = `
MATCH (proposal:Proposal {id: $proposalId})-[:SUBMITTED_BY]->(applicant:Researcher)
WITH collect(applicant) AS applicants

MATCH (proposal:Proposal {id: $proposalId})-[:ABOUT]->(topic:Topic)
MATCH (topic)<-[expertise:EXPERT_IN]-(candidate:Researcher)
WHERE NOT candidate IN applicants
WITH applicants, candidate,
     sum(expertise.weight) AS expertiseScore,
     collect(DISTINCT topic.name) AS matchedTopics

// Rule 1 — supervision, in either direction, never expires.
OPTIONAL MATCH (candidate)-[supervision:SUPERVISED]-(supervisionPeer:Researcher)
WHERE supervisionPeer IN applicants
WITH applicants, candidate, expertiseScore, matchedTopics,
     collect(DISTINCT {
       applicantId: supervisionPeer.id,
       applicantName: supervisionPeer.name,
       kind: supervision.kind,
       fromYear: supervision.fromYear,
       toYear: supervision.toYear
     }) AS supervisions

// Rule 2 — co-authorship inside the lookback window.
OPTIONAL MATCH (candidate)-[:AUTHORED]->(paper:Paper)<-[:AUTHORED]-(coAuthor:Researcher)
WHERE coAuthor IN applicants AND paper.year >= $coAuthorSince
WITH applicants, candidate, expertiseScore, matchedTopics, supervisions,
     collect(DISTINCT {
       applicantId: coAuthor.id,
       applicantName: coAuthor.name,
       title: paper.title,
       year: paper.year
     }) AS coAuthoredPapers

// Rule 3 — both hold an award from the same grant.
OPTIONAL MATCH (candidate)<-[:AWARDED_TO]-(grant:Grant)-[:AWARDED_TO]->(coInvestigator:Researcher)
WHERE coInvestigator IN applicants AND grant.endYear >= $grantSince
WITH applicants, candidate, expertiseScore, matchedTopics, supervisions, coAuthoredPapers,
     collect(DISTINCT {
       applicantId: coInvestigator.id,
       applicantName: coInvestigator.name,
       reference: grant.reference,
       title: grant.title,
       startYear: grant.startYear,
       endYear: grant.endYear
     }) AS sharedGrants

// Rule 4 — affiliated with the same institution over an overlapping period.
// Two intervals overlap when each starts before the other ends; an open-ended
// affiliation (toYear IS NULL) is treated as running to the current year.
OPTIONAL MATCH (candidate)-[candidateTenure:AFFILIATED_WITH]->(institution:Institution)
              <-[applicantTenure:AFFILIATED_WITH]-(colleague:Researcher)
WHERE colleague IN applicants
  AND candidateTenure.fromYear <= coalesce(applicantTenure.toYear, $currentYear)
  AND applicantTenure.fromYear <= coalesce(candidateTenure.toYear, $currentYear)
  AND coalesce(candidateTenure.toYear, $currentYear) >= $affiliationSince
  AND coalesce(applicantTenure.toYear, $currentYear) >= $affiliationSince
WITH applicants, candidate, expertiseScore, matchedTopics, supervisions,
     coAuthoredPapers, sharedGrants,
     collect(DISTINCT {
       applicantId: colleague.id,
       applicantName: colleague.name,
       institution: institution.name,
       fromYear: CASE
         WHEN candidateTenure.fromYear > applicantTenure.fromYear
         THEN candidateTenure.fromYear ELSE applicantTenure.fromYear END,
       toYear: CASE
         WHEN coalesce(candidateTenure.toYear, $currentYear) < coalesce(applicantTenure.toYear, $currentYear)
         THEN coalesce(candidateTenure.toYear, $currentYear)
         ELSE coalesce(applicantTenure.toYear, $currentYear) END
     }) AS sharedInstitutions

// A researcher's open-ended affiliation is their current post; there is at
// most one, so this needs no aggregation.
OPTIONAL MATCH (candidate)-[current:AFFILIATED_WITH]->(currentInstitution:Institution)
WHERE current.toYear IS NULL

RETURN candidate.id AS id,
       candidate.name AS name,
       candidate.registryId AS registryId,
       candidate.seniority AS seniority,
       candidate.field AS field,
       currentInstitution.name AS institution,
       currentInstitution.country AS country,
       expertiseScore,
       matchedTopics,
       supervisions,
       coAuthoredPapers,
       sharedGrants,
       sharedInstitutions
ORDER BY expertiseScore DESC, candidate.name
LIMIT $limit
`;

/**
 * Second-degree conflicts: two researchers who both publish repeatedly with
 * the same third person.
 *
 * Deliberately anchored on the applicants rather than the candidate pool. A
 * proposal has one to three applicants, so walking outwards from them touches
 * a few hundred nodes; running the same four-hop pattern from each of ~150
 * candidates would explore the same paths many times over.
 */
const SECOND_DEGREE = `
MATCH (proposal:Proposal {id: $proposalId})-[:SUBMITTED_BY]->(applicant:Researcher)
WITH collect(applicant) AS applicants
UNWIND applicants AS applicant

MATCH (applicant)-[:AUTHORED]->(applicantPaper:Paper)<-[:AUTHORED]-(bridge:Researcher)
WHERE applicantPaper.year >= $since AND bridge <> applicant
WITH applicants, applicant, bridge, count(DISTINCT applicantPaper) AS jointWithApplicant
WHERE jointWithApplicant >= $minJoint

MATCH (bridge)-[:AUTHORED]->(bridgePaper:Paper)<-[:AUTHORED]-(candidate:Researcher)
WHERE bridgePaper.year >= $since
  AND candidate <> bridge
  AND NOT candidate IN applicants
WITH applicant, bridge, jointWithApplicant, candidate,
     count(DISTINCT bridgePaper) AS jointWithCandidate
WHERE jointWithCandidate >= $minJoint

RETURN candidate.id AS candidateId,
       collect(DISTINCT {
         applicantId: applicant.id,
         applicantName: applicant.name,
         bridgeName: bridge.name,
         jointWithApplicant: jointWithApplicant,
         jointWithCandidate: jointWithCandidate
       }) AS bridges
`;

interface CandidateRow {
  id: string;
  name: string;
  registryId: string;
  seniority: string;
  field: string;
  institution: string | null;
  country: string | null;
  expertiseScore: number;
  matchedTopics: string[];
  supervisions: Array<{
    applicantId: string;
    applicantName: string;
    kind: string;
    fromYear: number;
    toYear: number;
  }>;
  coAuthoredPapers: Array<{
    applicantId: string;
    applicantName: string;
    title: string;
    year: number;
  }>;
  sharedGrants: Array<{
    applicantId: string;
    applicantName: string;
    reference: string;
    title: string;
    startYear: number;
    endYear: number;
  }>;
  sharedInstitutions: Array<{
    applicantId: string;
    applicantName: string;
    institution: string;
    fromYear: number;
    toYear: number;
  }>;
}

interface SecondDegreeRow {
  candidateId: string;
  bridges: Array<{
    applicantId: string;
    applicantName: string;
    bridgeName: string;
    jointWithApplicant: number;
    jointWithCandidate: number;
  }>;
}

/** Groups a rule's rows by applicant, since one rule can conflict with several. */
function groupByApplicant<T extends { applicantId: string; applicantName: string }>(
  rows: readonly T[],
): Map<string, { name: string; items: T[] }> {
  const grouped = new Map<string, { name: string; items: T[] }>();
  for (const row of rows) {
    // `collect(DISTINCT ...)` yields a row of nulls when nothing matched.
    if (!row?.applicantId) continue;
    const entry = grouped.get(row.applicantId) ?? { name: row.applicantName, items: [] };
    entry.items.push(row);
    grouped.set(row.applicantId, entry);
  }
  return grouped;
}

function buildConflicts(
  row: CandidateRow,
  secondDegree: SecondDegreeRow | undefined,
): ConflictEvidence[] {
  const conflicts: ConflictEvidence[] = [];

  for (const [applicantId, { name, items }] of groupByApplicant(row.supervisions)) {
    const first = items[0];
    conflicts.push({
      ruleId: "supervision",
      severity: RULES_BY_ID.supervision.severity,
      label: RULES_BY_ID.supervision.label,
      detail: `${first.kind} supervision, ${first.fromYear}–${first.toYear}`,
      examples: items.map((item) => `${item.kind} supervision ${item.fromYear}–${item.toYear}`),
      withApplicantId: applicantId,
      withApplicantName: name,
    });
  }

  for (const [applicantId, { name, items }] of groupByApplicant(row.coAuthoredPapers)) {
    const mostRecent = Math.max(...items.map((item) => item.year));
    conflicts.push({
      ruleId: "co-author",
      severity: RULES_BY_ID["co-author"].severity,
      label: RULES_BY_ID["co-author"].label,
      detail:
        items.length === 1
          ? `1 joint paper (${mostRecent})`
          : `${items.length} joint papers, most recent ${mostRecent}`,
      examples: [...items]
        .sort((a, b) => b.year - a.year)
        .slice(0, 4)
        .map((item) => `“${item.title}” (${item.year})`),
      withApplicantId: applicantId,
      withApplicantName: name,
    });
  }

  for (const [applicantId, { name, items }] of groupByApplicant(row.sharedGrants)) {
    conflicts.push({
      ruleId: "co-investigator",
      severity: RULES_BY_ID["co-investigator"].severity,
      label: RULES_BY_ID["co-investigator"].label,
      detail:
        items.length === 1
          ? `Joint award ${items[0].reference}`
          : `${items.length} joint awards`,
      examples: items.map(
        (item) => `${item.reference} — “${item.title}” (${item.startYear}–${item.endYear})`,
      ),
      withApplicantId: applicantId,
      withApplicantName: name,
    });
  }

  for (const [applicantId, { name, items }] of groupByApplicant(row.sharedInstitutions)) {
    const first = items[0];
    conflicts.push({
      ruleId: "shared-institution",
      severity: RULES_BY_ID["shared-institution"].severity,
      label: RULES_BY_ID["shared-institution"].label,
      detail: `${first.institution}, overlapping ${first.fromYear}–${first.toYear}`,
      examples: items.map(
        (item) => `${item.institution}, both present ${item.fromYear}–${item.toYear}`,
      ),
      withApplicantId: applicantId,
      withApplicantName: name,
    });
  }

  // Second-degree links are only worth surfacing when nothing already blocks
  // the candidate — otherwise the panel is reading noise under a hard stop.
  if (conflicts.length === 0 && secondDegree) {
    for (const [applicantId, { name, items }] of groupByApplicant(secondDegree.bridges)) {
      conflicts.push({
        ruleId: "second-degree",
        severity: RULES_BY_ID["second-degree"].severity,
        label: RULES_BY_ID["second-degree"].label,
        detail:
          items.length === 1
            ? `Both work closely with ${items[0].bridgeName}`
            : `${items.length} shared frequent collaborators`,
        examples: items.map(
          (item) =>
            `${item.bridgeName} — ${item.jointWithApplicant} papers with ${item.applicantName}, ` +
            `${item.jointWithCandidate} with this reviewer`,
        ),
        withApplicantId: applicantId,
        withApplicantName: name,
      });
    }
  }

  return conflicts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

export async function screenReviewers(
  proposalId: string,
  limit = 250,
): Promise<ScreeningResult | null> {
  // All three statements are issued together rather than fetching the proposal
  // first and then screening. They do not depend on one another, and at this
  // instance's round-trip latency a sequential first query would add most of a
  // second to every page load. If the proposal turns out not to exist the two
  // screening queries were wasted, but that is the rare path and they return
  // nothing quickly.
  const [proposal, candidates, secondDegree] = await Promise.all([
    getProposal(proposalId),
    runRead<CandidateRow>(SCREEN_CANDIDATES, {
      proposalId,
      coAuthorSince: CURRENT_YEAR - CO_AUTHOR_WINDOW_YEARS,
      grantSince: CURRENT_YEAR - GRANT_WINDOW_YEARS,
      affiliationSince: CURRENT_YEAR - AFFILIATION_WINDOW_YEARS,
      currentYear: CURRENT_YEAR,
      limit,
    }),
    runRead<SecondDegreeRow>(SECOND_DEGREE, {
      proposalId,
      since: CURRENT_YEAR - CO_AUTHOR_WINDOW_YEARS,
      minJoint: SECOND_DEGREE_MIN_JOINT_PAPERS,
    }),
  ]);

  if (!proposal) return null;

  const bridgesByCandidate = new Map(
    secondDegree.map((row) => [row.candidateId, row]),
  );

  const reviewers: ScreenedReviewer[] = candidates.map((row) => {
    const conflicts = buildConflicts(row, bridgesByCandidate.get(row.id));
    return {
      researcher: {
        id: row.id,
        name: row.name,
        registryId: row.registryId,
        seniority: row.seniority,
        field: row.field,
        institution: row.institution,
        country: row.country,
      },
      expertiseScore: row.expertiseScore,
      matchedTopics: row.matchedTopics,
      conflicts,
      verdict: verdictFor(conflicts.map((conflict) => conflict.severity)),
    };
  });

  const counts: Record<Verdict, number> = { clear: 0, caution: 0, blocked: 0 };
  for (const reviewer of reviewers) counts[reviewer.verdict] += 1;

  return { proposal, reviewers, counts };
}
