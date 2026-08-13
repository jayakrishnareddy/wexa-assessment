import { config as loadDotenv } from "dotenv";

// Load before anything imports the env module, so `readEnv()` sees the values.
loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

import {
  ConfigurationError,
  DatabaseUnavailableError,
  closeDriver,
  runWrite,
} from "../../src/lib/neo4j";
import { generateWorld, type GeneratedWorld } from "./generate";
import { CONSTRAINTS, INDEXES } from "./schema";

const BATCH_SIZE = 500;

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Writes one collection in fixed-size batches.
 *
 * Everything goes through `UNWIND $rows` — the Cypher text is a constant and
 * the data rides along as a parameter. That keeps the query plan cached across
 * batches and means no value is ever concatenated into a statement.
 */
async function writeBatched<T>(
  label: string,
  rows: readonly T[],
  cypher: string,
): Promise<void> {
  if (rows.length === 0) {
    log(`  ${label}: nothing to write`);
    return;
  }

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    await runWrite(cypher, { rows: batch });
  }
  log(`  ${label}: ${rows.length.toLocaleString()}`);
}

async function applySchema(): Promise<void> {
  log("Applying constraints and indexes…");
  for (const statement of [...CONSTRAINTS, ...INDEXES]) {
    await runWrite(statement);
  }
  log(`  ${CONSTRAINTS.length} constraints, ${INDEXES.length} indexes`);
}

/**
 * Deletes in bounded chunks rather than one `MATCH (n) DETACH DELETE n`, which
 * would build a transaction far larger than the free tier's 256 MB of RAM.
 */
async function wipe(): Promise<void> {
  log("Clearing existing data…");
  let removed = 0;
  for (;;) {
    const rows = await runWrite<{ deleted: number }>(
      `MATCH (n)
       WITH n LIMIT $limit
       DETACH DELETE n
       RETURN count(n) AS deleted`,
      { limit: 5_000 },
    );
    const deleted = rows[0]?.deleted ?? 0;
    removed += deleted;
    if (deleted === 0) break;
  }
  log(`  removed ${removed.toLocaleString()} nodes`);
}

async function loadNodes(world: GeneratedWorld): Promise<void> {
  log("Writing nodes…");

  await writeBatched(
    "Institution",
    world.institutions,
    `UNWIND $rows AS row
     MERGE (i:Institution {id: row.id})
     SET i.name = row.name, i.country = row.country, i.kind = row.kind`,
  );

  await writeBatched(
    "Funder",
    world.funders,
    `UNWIND $rows AS row
     MERGE (f:Funder {id: row.id})
     SET f.name = row.name,
         f.shortName = row.shortName,
         f.country = row.country,
         f.kind = row.kind`,
  );

  await writeBatched(
    "Topic",
    world.topics,
    `UNWIND $rows AS row
     MERGE (t:Topic {id: row.id})
     SET t.name = row.name, t.field = row.field`,
  );

  await writeBatched(
    "Researcher",
    world.researchers,
    `UNWIND $rows AS row
     MERGE (r:Researcher {id: row.id})
     SET r.name = row.name,
         r.nameLower = toLower(row.name),
         r.registryId = row.registryId,
         r.seniority = row.seniority,
         r.field = row.field,
         r.careerStart = row.careerStart`,
  );

  await writeBatched(
    "Paper",
    world.papers,
    `UNWIND $rows AS row
     MERGE (p:Paper {id: row.id})
     SET p.title = row.title,
         p.year = row.year,
         p.field = row.field,
         p.citations = row.citations`,
  );

  await writeBatched(
    "Grant",
    world.grants,
    `UNWIND $rows AS row
     MERGE (g:Grant {id: row.id})
     SET g.reference = row.reference,
         g.title = row.title,
         g.programme = row.programme,
         g.amountUsd = row.amountUsd,
         g.startYear = row.startYear,
         g.endYear = row.endYear`,
  );

  await writeBatched(
    "Proposal",
    world.proposals,
    `UNWIND $rows AS row
     MERGE (p:Proposal {id: row.id})
     SET p.reference = row.reference,
         p.title = row.title,
         p.summary = row.summary,
         p.submittedYear = row.submittedYear,
         p.requestedUsd = row.requestedUsd,
         p.field = row.field`,
  );
}

async function loadRelationships(world: GeneratedWorld): Promise<void> {
  log("Writing relationships…");

  await writeBatched(
    "AFFILIATED_WITH",
    world.affiliations,
    `UNWIND $rows AS row
     MATCH (r:Researcher {id: row.researcherId})
     MATCH (i:Institution {id: row.institutionId})
     MERGE (r)-[a:AFFILIATED_WITH {fromYear: row.fromYear}]->(i)
     SET a.toYear = row.toYear, a.role = row.role`,
  );

  await writeBatched(
    "SUPERVISED",
    world.supervisions,
    `UNWIND $rows AS row
     MATCH (supervisor:Researcher {id: row.supervisorId})
     MATCH (supervisee:Researcher {id: row.superviseeId})
     MERGE (supervisor)-[s:SUPERVISED]->(supervisee)
     SET s.fromYear = row.fromYear, s.toYear = row.toYear, s.kind = row.kind`,
  );

  await writeBatched(
    "AUTHORED",
    world.authorships,
    `UNWIND $rows AS row
     MATCH (r:Researcher {id: row.researcherId})
     MATCH (p:Paper {id: row.paperId})
     MERGE (r)-[a:AUTHORED]->(p)
     SET a.position = row.position, a.corresponding = row.corresponding`,
  );

  await writeBatched(
    "Paper ABOUT Topic",
    world.paperTopics,
    `UNWIND $rows AS row
     MATCH (p:Paper {id: row.from})
     MATCH (t:Topic {id: row.to})
     MERGE (p)-[:ABOUT]->(t)`,
  );

  await writeBatched(
    "FUNDED_BY",
    world.grants,
    `UNWIND $rows AS row
     MATCH (g:Grant {id: row.id})
     MATCH (f:Funder {id: row.funderId})
     MERGE (g)-[:FUNDED_BY]->(f)`,
  );

  await writeBatched(
    "AWARDED_TO",
    world.grantAwards,
    `UNWIND $rows AS row
     MATCH (g:Grant {id: row.grantId})
     MATCH (r:Researcher {id: row.researcherId})
     MERGE (g)-[a:AWARDED_TO]->(r)
     SET a.role = row.role`,
  );

  await writeBatched(
    "EXPERT_IN",
    world.expertise,
    `UNWIND $rows AS row
     MATCH (r:Researcher {id: row.from})
     MATCH (t:Topic {id: row.to})
     MERGE (r)-[e:EXPERT_IN]->(t)
     SET e.weight = row.weight`,
  );

  await writeBatched(
    "Proposal FUNDED_BY",
    world.proposals,
    `UNWIND $rows AS row
     MATCH (p:Proposal {id: row.id})
     MATCH (f:Funder {id: row.funderId})
     MERGE (p)-[:FUNDED_BY]->(f)`,
  );

  await writeBatched(
    "SUBMITTED_BY",
    world.proposalApplicants,
    `UNWIND $rows AS row
     MATCH (p:Proposal {id: row.from})
     MATCH (r:Researcher {id: row.to})
     MERGE (p)-[s:SUBMITTED_BY]->(r)
     SET s.role = row.role`,
  );

  await writeBatched(
    "Proposal ABOUT Topic",
    world.proposalTopics,
    `UNWIND $rows AS row
     MATCH (p:Proposal {id: row.from})
     MATCH (t:Topic {id: row.to})
     MERGE (p)-[:ABOUT]->(t)`,
  );
}

async function summarise(): Promise<void> {
  const [nodes] = await runWrite<{ nodes: number }>(
    "MATCH (n) RETURN count(n) AS nodes",
  );
  const [relationships] = await runWrite<{ relationships: number }>(
    "MATCH ()-[r]->() RETURN count(r) AS relationships",
  );
  log("");
  log(
    `Done — ${nodes.nodes.toLocaleString()} nodes and ` +
      `${relationships.relationships.toLocaleString()} relationships in the graph.`,
  );
}

async function main(): Promise<void> {
  const keepExisting = process.argv.includes("--keep-existing");

  log("Generating the research community…");
  const world = generateWorld();
  log(
    `  ${world.researchers.length} researchers, ${world.papers.length} papers, ` +
      `${world.grants.length} grants, ${world.proposals.length} proposals under review`,
  );

  await applySchema();
  if (!keepExisting) await wipe();
  await loadNodes(world);
  await loadRelationships(world);
  await summarise();
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    if (error instanceof ConfigurationError) {
      log("");
      log("Cannot seed: CognoDB is not configured.");
      for (const problem of error.problems) log(`  - ${problem}`);
      log("");
      log("Copy .env.example to .env.local and fill in your instance details.");
      return;
    }
    if (error instanceof DatabaseUnavailableError) {
      log("");
      log(`Cannot seed: ${error.message}`);
      log("Check the instance is running at https://console.cognodb.com");
      return;
    }
    log("");
    log("Seeding failed:");
    log(String(error instanceof Error ? error.stack ?? error.message : error));
  })
  .finally(async () => {
    await closeDriver();
  });
