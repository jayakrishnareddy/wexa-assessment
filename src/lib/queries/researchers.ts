import { runRead } from "../neo4j";
import type { ResearcherSummary } from "../types";

/**
 * Name search for the ad-hoc pair check.
 *
 * Matching is done against the denormalised `nameLower` property, which the
 * seed script writes and `researcher_name_lower` indexes. Lower-casing at write
 * time rather than calling `toLower(r.name)` in the predicate keeps the
 * comparison index-friendly instead of forcing a scan over every researcher.
 */
const SEARCH_RESEARCHERS = `
MATCH (researcher:Researcher)
WHERE $query = '' OR researcher.nameLower CONTAINS $query
OPTIONAL MATCH (researcher)-[post:AFFILIATED_WITH]->(institution:Institution)
WHERE post.toYear IS NULL
RETURN researcher.id AS id,
       researcher.name AS name,
       researcher.registryId AS registryId,
       researcher.seniority AS seniority,
       researcher.field AS field,
       institution.name AS institution,
       institution.country AS country
ORDER BY researcher.name
LIMIT $limit
`;

export async function searchResearchers(
  query: string,
  limit = 20,
): Promise<ResearcherSummary[]> {
  return runRead<ResearcherSummary>(SEARCH_RESEARCHERS, {
    query: query.trim().toLowerCase(),
    limit,
  });
}

/**
 * Headline numbers for the dashboard.
 *
 * Counted in one statement so the landing page makes a single round trip
 * rather than one per label.
 */
const GRAPH_STATS = `
MATCH (researcher:Researcher)
WITH count(researcher) AS researchers
MATCH (paper:Paper)
WITH researchers, count(paper) AS papers
MATCH (institution:Institution)
WITH researchers, papers, count(institution) AS institutions
MATCH (grant:Grant)
WITH researchers, papers, institutions, count(grant) AS grants
MATCH (proposal:Proposal)
WITH researchers, papers, institutions, grants, count(proposal) AS proposals
MATCH ()-[relationship]->()
RETURN researchers, papers, institutions, grants, proposals,
       count(relationship) AS relationships
`;

export interface GraphStats {
  researchers: number;
  papers: number;
  institutions: number;
  grants: number;
  proposals: number;
  relationships: number;
}

export async function getGraphStats(): Promise<GraphStats> {
  const rows = await runRead<GraphStats>(GRAPH_STATS);
  return (
    rows[0] ?? {
      researchers: 0,
      papers: 0,
      institutions: 0,
      grants: 0,
      proposals: 0,
      relationships: 0,
    }
  );
}
