import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

import {
  ConfigurationError,
  DatabaseUnavailableError,
  checkHealth,
  closeDriver,
  runRead,
  runWrite,
} from "../src/lib/neo4j";

/**
 * Connectivity and capability probe.
 *
 * CognoDB implements openCypher, which overlaps with but is not identical to
 * Neo4j's Cypher. Rather than discover a missing feature halfway through the
 * UI, this script asks the live instance what it supports and prints a report.
 */

interface Probe {
  name: string;
  cypher: string;
  params?: Record<string, unknown>;
  /** Notes what we fall back to if the feature is missing. */
  fallback: string;
}

const PROBES: Probe[] = [
  {
    name: "Parameters",
    cypher: "RETURN $value AS value",
    params: { value: 42 },
    fallback: "none — parameters are mandatory",
  },
  {
    name: "Aggregation (collect / count / sum)",
    cypher:
      "UNWIND [1, 2, 3] AS n RETURN collect(n) AS all, count(n) AS total, sum(n) AS sum",
    fallback: "none — used everywhere",
  },
  {
    name: "Map literals in collect()",
    cypher: "UNWIND [1, 2] AS n RETURN collect({value: n, doubled: n * 2}) AS rows",
    fallback: "return parallel lists and zip them in TypeScript",
  },
  {
    name: "CASE expression",
    cypher: "RETURN CASE WHEN 2 > 1 THEN 'yes' ELSE 'no' END AS answer",
    fallback: "compute the branch in TypeScript",
  },
  {
    name: "coalesce()",
    cypher: "RETURN coalesce(null, 7) AS value",
    fallback: "explicit IS NULL checks in the WHERE clause",
  },
  {
    name: "List membership (IN)",
    cypher: "WITH [1, 2, 3] AS xs RETURN 2 IN xs AS found",
    fallback: "join on ids in TypeScript",
  },
  {
    name: "OPTIONAL MATCH",
    cypher: "OPTIONAL MATCH (n:__ProbeMissingLabel) RETURN count(n) AS matched",
    fallback: "none — every conflict rule is a left join",
  },
  {
    name: "Pattern comprehension",
    cypher: "MATCH (n) WITH n LIMIT 1 RETURN [(n)-->(m) | m] AS neighbours",
    fallback: "sequential OPTIONAL MATCH + collect (what the app already does)",
  },
  {
    name: "CALL {} subquery",
    cypher: "CALL { RETURN 1 AS one } RETURN one",
    fallback: "separate round trips composed in the query layer",
  },
  {
    name: "shortestPath()",
    cypher: `MATCH (a:Researcher), (b:Researcher)
             WHERE a.id = $a AND b.id = $b
             MATCH p = shortestPath((a)-[:AUTHORED*1..6]-(b))
             RETURN length(p) AS hops`,
    params: { a: "res-0001", b: "res-0002" },
    fallback: "variable-length MATCH with LIMIT 1 ordered by length",
  },
  {
    name: "Variable-length paths",
    cypher: `MATCH (a:Researcher)-[:AUTHORED*1..2]-(b)
             WHERE a.id = $a
             RETURN count(DISTINCT b) AS reached`,
    params: { a: "res-0001" },
    fallback: "none — multi-hop traversal is the point of the app",
  },
  {
    name: "Relationship type disjunction",
    cypher: `MATCH (a:Researcher)-[:AUTHORED|AFFILIATED_WITH]-(b)
             WHERE a.id = $a
             RETURN count(b) AS reached`,
    params: { a: "res-0001" },
    fallback: "one MATCH per relationship type, unioned in TypeScript",
  },
];

function log(message = ""): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Behaviour probes.
 *
 * Unlike the feature probes above, these statements all *run* — the question
 * is whether they return the right answer. Both were found the hard way while
 * building the pairwise conflict query, where they silently reported that
 * every candidate reviewer shared the applicant's supervision record. They are
 * checked here so the workaround in `src/lib/queries/explain.ts` has a
 * reproducible justification, and so a future CognoDB release that fixes them
 * shows up as a passing probe rather than going unnoticed.
 */
async function probeBehaviour(): Promise<void> {
  log("");
  log("Probing known behaviour differences…");

  await runWrite(`
    CREATE (a:__ProbeR {id: 'probe-a'})-[:__PROBE_REL {tag: 'linked'}]->(b:__ProbeR {id: 'probe-b'})
    CREATE (c:__ProbeR {id: 'probe-c'})
  `);

  try {
    // 'probe-a' is linked to 'probe-b' only. Filtering to 'probe-c' must yield
    // no relationship, and must leave the bound variable pointing at 'probe-c'.
    const [rebind] = await runRead<{ id: string; tag: string | null }>(
      `MATCH (a:__ProbeR {id: 'probe-a'})
       MATCH (c:__ProbeR {id: 'probe-c'})
       OPTIONAL MATCH (a)-[r:__PROBE_REL]->(c)
       RETURN c.id AS id, r.tag AS tag`,
    );
    report(
      "Bound variable in OPTIONAL MATCH filters (does not rebind)",
      rebind?.id === "probe-c" && rebind?.tag === null,
      `got id=${rebind?.id} tag=${rebind?.tag} — expected id=probe-c tag=null`,
    );

    const [paramPredicate] = await runRead<{ tag: string | null }>(
      `MATCH (a:__ProbeR {id: 'probe-a'})
       OPTIONAL MATCH (a)-[r:__PROBE_REL]->(x:__ProbeR)
       WHERE x.id = $target
       RETURN r.tag AS tag`,
      { target: "probe-c" },
    );
    report(
      "Parameter id predicate applies in 1-hop OPTIONAL MATCH",
      paramPredicate?.tag === null,
      `got tag=${paramPredicate?.tag} — expected null`,
    );

    const [boundPredicate] = await runRead<{ tag: string | null }>(
      `MATCH (a:__ProbeR {id: 'probe-a'})
       MATCH (c:__ProbeR {id: 'probe-c'})
       OPTIONAL MATCH (a)-[r:__PROBE_REL]->(x:__ProbeR)
       WHERE x.id = c.id
       RETURN r.tag AS tag`,
    );
    report(
      "Bound-node id predicate applies (the workaround)",
      boundPredicate?.tag === null,
      `got tag=${boundPredicate?.tag} — expected null`,
    );
  } finally {
    await runWrite("MATCH (n:__ProbeR) DETACH DELETE n");
  }
}

function report(name: string, ok: boolean, detail: string): void {
  if (ok) {
    log(`  ok        ${name}`);
  } else {
    log(`  DIFFERS   ${name}`);
    log(`            ${detail}`);
  }
}

async function main(): Promise<void> {
  log("Checking CognoDB connection…");

  const health = await checkHealth();
  if (!health.ok) {
    if (health.kind === "config") {
      log("");
      log("Not configured:");
      for (const problem of health.problems) log(`  - ${problem}`);
      log("");
      log("Copy .env.example to .env.local and fill in your instance details.");
    } else {
      log("");
      log(`Could not connect: ${health.reason}`);
      log("Check the instance is running at https://console.cognodb.com");
    }
    process.exitCode = 1;
    return;
  }

  log("  connected");

  const [{ nodes }] = await runRead<{ nodes: number }>(
    "MATCH (n) RETURN count(n) AS nodes",
  );
  const [{ relationships }] = await runRead<{ relationships: number }>(
    "MATCH ()-[r]->() RETURN count(r) AS relationships",
  );
  log(
    `  graph contains ${nodes.toLocaleString()} nodes and ` +
      `${relationships.toLocaleString()} relationships`,
  );

  log("");
  log("Verifying write access…");
  await runWrite("CREATE (:__ProbeNode {id: $id})", { id: "probe" });
  await runWrite("MATCH (n:__ProbeNode {id: $id}) DELETE n", { id: "probe" });
  log("  writes accepted");

  log("");
  log("Probing Cypher features…");
  const unsupported: Probe[] = [];

  for (const probe of PROBES) {
    try {
      await runRead(probe.cypher, probe.params ?? {});
      log(`  ok        ${probe.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A probe that needs seeded data fails differently from an unsupported
      // feature; report both, but only the latter forces a redesign.
      log(`  FAILED    ${probe.name}`);
      log(`            ${message.split("\n")[0]}`);
      log(`            fallback: ${probe.fallback}`);
      unsupported.push(probe);
    }
  }

  await probeBehaviour();

  log("");
  if (unsupported.length === 0) {
    log("All probed Cypher features are supported.");
  } else {
    log(`${unsupported.length} feature(s) failed — see fallbacks above.`);
    log("If the graph is empty, seed it first with `npm run seed` and re-run.");
  }
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    if (error instanceof ConfigurationError) {
      log("");
      log("Not configured:");
      for (const problem of error.problems) log(`  - ${problem}`);
      return;
    }
    if (error instanceof DatabaseUnavailableError) {
      log("");
      log(error.message);
      return;
    }
    log("");
    log(String(error instanceof Error ? (error.stack ?? error.message) : error));
  })
  .finally(async () => {
    await closeDriver();
  });
