/**
 * Constraints and indexes.
 *
 * Uniqueness constraints double as lookup indexes, which is what keeps the
 * `MERGE` statements in the loader from degrading into full scans as the graph
 * grows. Every statement is `IF NOT EXISTS`, so seeding is safe to re-run.
 */
export const CONSTRAINTS: readonly string[] = [
  "CREATE CONSTRAINT researcher_id IF NOT EXISTS FOR (r:Researcher) REQUIRE r.id IS UNIQUE",
  "CREATE CONSTRAINT paper_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.id IS UNIQUE",
  "CREATE CONSTRAINT institution_id IF NOT EXISTS FOR (i:Institution) REQUIRE i.id IS UNIQUE",
  "CREATE CONSTRAINT funder_id IF NOT EXISTS FOR (f:Funder) REQUIRE f.id IS UNIQUE",
  "CREATE CONSTRAINT grant_id IF NOT EXISTS FOR (g:Grant) REQUIRE g.id IS UNIQUE",
  "CREATE CONSTRAINT proposal_id IF NOT EXISTS FOR (p:Proposal) REQUIRE p.id IS UNIQUE",
  "CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE",
];

export const INDEXES: readonly string[] = [
  // Case-insensitive researcher search in the UI matches on `nameLower`.
  "CREATE INDEX researcher_name_lower IF NOT EXISTS FOR (r:Researcher) ON (r.nameLower)",
  // Co-authorship conflict rules filter papers by publication year.
  "CREATE INDEX paper_year IF NOT EXISTS FOR (p:Paper) ON (p.year)",
  // Grant conflict rules filter by the award window.
  "CREATE INDEX grant_end_year IF NOT EXISTS FOR (g:Grant) ON (g.endYear)",
];
