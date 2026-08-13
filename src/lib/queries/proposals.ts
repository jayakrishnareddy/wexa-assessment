import { runRead } from "../neo4j";
import type { ProposalDetail, ProposalSummary, ResearcherSummary } from "../types";

/**
 * Every query in this module sticks to a conservative openCypher subset —
 * MATCH / OPTIONAL MATCH / WITH / UNWIND / aggregation. Pattern comprehensions
 * and `CALL {}` subqueries would express some of this more tersely, but they
 * are Neo4j extensions and this application targets CognoDB.
 */

interface ApplicantRow {
  id: string;
  name: string;
  registryId: string;
  seniority: string;
  field: string;
  institution: string | null;
  country: string | null;
}

/** Reused wherever a researcher needs their *current* affiliation attached. */
const CURRENT_AFFILIATION = `
  OPTIONAL MATCH (applicant)-[affiliation:AFFILIATED_WITH]->(institution:Institution)
  WHERE affiliation.toYear IS NULL
`;

/**
 * One statement serves both the list and the detail view: passing `null` for
 * `$proposalId` returns every proposal. Keeping it as a single constant means
 * there is exactly one place where this shape is defined, and no code path
 * that assembles Cypher from strings.
 */
const PROPOSALS = `
MATCH (proposal:Proposal)-[:FUNDED_BY]->(funder:Funder)
WHERE $proposalId IS NULL OR proposal.id = $proposalId
OPTIONAL MATCH (proposal)-[:ABOUT]->(topic:Topic)
WITH proposal, funder, collect(DISTINCT topic.name) AS topics
MATCH (proposal)-[submission:SUBMITTED_BY]->(applicant:Researcher)
${CURRENT_AFFILIATION}
WITH proposal, funder, topics, submission, applicant, institution
ORDER BY submission.role DESC, applicant.name
WITH proposal, funder, topics,
     collect({
       id: applicant.id,
       name: applicant.name,
       registryId: applicant.registryId,
       seniority: applicant.seniority,
       field: applicant.field,
       institution: institution.name,
       country: institution.country
     }) AS applicants
RETURN proposal.id AS id,
       proposal.reference AS reference,
       proposal.title AS title,
       proposal.summary AS summary,
       proposal.field AS field,
       proposal.submittedYear AS submittedYear,
       proposal.requestedUsd AS requestedUsd,
       funder.shortName AS funder,
       topics,
       applicants
ORDER BY proposal.reference
`;

interface ProposalRow {
  id: string;
  reference: string;
  title: string;
  summary: string;
  field: string;
  submittedYear: number;
  requestedUsd: number;
  funder: string;
  topics: string[];
  applicants: ApplicantRow[];
}

function toSummary(row: ProposalRow): ProposalDetail {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    summary: row.summary,
    field: row.field,
    submittedYear: row.submittedYear,
    requestedUsd: row.requestedUsd,
    funder: row.funder,
    topics: row.topics,
    applicants: row.applicants.map(
      (applicant): ResearcherSummary => ({
        id: applicant.id,
        name: applicant.name,
        registryId: applicant.registryId,
        seniority: applicant.seniority,
        field: applicant.field,
        institution: applicant.institution,
        country: applicant.country,
      }),
    ),
  };
}

export async function listProposals(): Promise<ProposalSummary[]> {
  const rows = await runRead<ProposalRow>(PROPOSALS, { proposalId: null });
  return rows.map(toSummary);
}

export async function getProposal(proposalId: string): Promise<ProposalDetail | null> {
  const rows = await runRead<ProposalRow>(PROPOSALS, { proposalId });
  return rows.length > 0 ? toSummary(rows[0]) : null;
}
