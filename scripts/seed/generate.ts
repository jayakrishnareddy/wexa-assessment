import {
  CURRENT_YEAR,
} from "../../src/lib/domain";
import {
  FAMILY_NAMES,
  FIELDS,
  FUNDERS,
  GIVEN_NAMES,
  GRANT_PROGRAMMES,
  INSTITUTIONS,
  type FieldSeed,
  type Seniority,
} from "./reference-data";
import {
  aroundMean,
  chance,
  createRng,
  intBetween,
  pick,
  sample,
  shuffle,
  weightedPick,
  type Rng,
} from "./random";

export interface Institution {
  id: string;
  name: string;
  country: string;
  kind: string;
}

export interface Funder {
  id: string;
  name: string;
  shortName: string;
  country: string;
  kind: string;
}

export interface Topic {
  id: string;
  name: string;
  field: string;
}

export interface Researcher {
  id: string;
  name: string;
  registryId: string;
  seniority: Seniority;
  field: string;
  careerStart: number;
}

export interface Affiliation {
  researcherId: string;
  institutionId: string;
  fromYear: number;
  /** `null` means the affiliation is current. */
  toYear: number | null;
  role: string;
}

export interface Supervision {
  supervisorId: string;
  superviseeId: string;
  fromYear: number;
  toYear: number;
  kind: "Doctoral" | "Postdoctoral";
}

export interface Paper {
  id: string;
  title: string;
  year: number;
  field: string;
  citations: number;
}

export interface Authorship {
  researcherId: string;
  paperId: string;
  position: number;
  corresponding: boolean;
}

export interface Grant {
  id: string;
  reference: string;
  title: string;
  programme: string;
  amountUsd: number;
  startYear: number;
  endYear: number;
  funderId: string;
}

export interface GrantAward {
  grantId: string;
  researcherId: string;
  role: "Principal Investigator" | "Co-Investigator";
}

export interface Proposal {
  id: string;
  reference: string;
  title: string;
  summary: string;
  submittedYear: number;
  requestedUsd: number;
  field: string;
  funderId: string;
}

export interface Link {
  from: string;
  to: string;
}

export interface WeightedLink extends Link {
  weight: number;
}

export interface GeneratedWorld {
  institutions: Institution[];
  funders: Funder[];
  topics: Topic[];
  researchers: Researcher[];
  affiliations: Affiliation[];
  supervisions: Supervision[];
  papers: Paper[];
  authorships: Authorship[];
  paperTopics: Link[];
  grants: Grant[];
  grantAwards: GrantAward[];
  expertise: WeightedLink[];
  proposals: Proposal[];
  proposalApplicants: Array<Link & { role: "Lead Applicant" | "Co-Applicant" }>;
  proposalTopics: Link[];
}

export interface GenerateOptions {
  seed?: number;
  researcherCount?: number;
  paperCount?: number;
  grantCount?: number;
  proposalCount?: number;
}

/** Career length in years, by seniority — used to place people on a timeline. */
const CAREER_LENGTH: Record<Seniority, [number, number]> = {
  "PhD Student": [1, 5],
  "Postdoctoral Researcher": [4, 9],
  "Assistant Professor": [8, 14],
  "Group Leader": [12, 25],
  "Associate Professor": [13, 21],
  Professor: [18, 34],
  "Emeritus Professor": [35, 45],
};

/** Rough shape of a real department, weighted towards mid-career people. */
const SENIORITY_WEIGHTS: Array<[Seniority, number]> = [
  ["PhD Student", 22],
  ["Postdoctoral Researcher", 20],
  ["Assistant Professor", 14],
  ["Associate Professor", 14],
  ["Professor", 18],
  ["Group Leader", 9],
  ["Emeritus Professor", 3],
];

const TITLE_PATTERNS = [
  (method: string, object: string) => `${method} for ${object}`,
  (method: string, object: string) => `${method} reveals ${object}`,
  (method: string, object: string) =>
    `Towards ${object}: a ${lowerFirst(method)} approach`,
  (method: string, object: string) => `Benchmarking ${lowerFirst(method)} on ${object}`,
  (method: string, object: string) => `Rethinking ${object} through ${lowerFirst(method)}`,
  (method: string, object: string) => `${method} improves the analysis of ${object}`,
];

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function padded(prefix: string, index: number, width = 4): string {
  return `${prefix}-${String(index + 1).padStart(width, "0")}`;
}

function topicId(field: string, topic: string): string {
  return `t-${slug(field)}-${slug(topic)}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeTitle(rng: Rng, field: FieldSeed): string {
  const pattern = pick(rng, TITLE_PATTERNS);
  return pattern(pick(rng, field.methods), pick(rng, field.objects));
}

/**
 * Builds a synthetic but structurally realistic research community.
 *
 * The important property is that collaboration is *clustered*, not uniform:
 * co-authors are chosen by preferential attachment over prior collaborations,
 * shared institutions and shared fields. Uniformly random edges would make
 * every reviewer equally distant from every applicant and the conflict queries
 * would have nothing interesting to find.
 */
export function generateWorld(options: GenerateOptions = {}): GeneratedWorld {
  const {
    seed = 20260214,
    researcherCount = 420,
    paperCount = 1400,
    grantCount = 180,
    proposalCount = 28,
  } = options;

  const rng = createRng(seed);

  const institutions: Institution[] = INSTITUTIONS.map((entry, index) => ({
    id: padded("inst", index, 3),
    name: entry.name,
    country: entry.country,
    kind: entry.kind,
  }));

  const funders: Funder[] = FUNDERS.map((entry, index) => ({
    id: padded("fund", index, 3),
    name: entry.name,
    shortName: entry.shortName,
    country: entry.country,
    kind: entry.kind,
  }));

  const topics: Topic[] = FIELDS.flatMap((field) =>
    field.topics.map((topic) => ({
      id: topicId(field.name, topic),
      name: topic,
      field: field.name,
    })),
  );

  const topicsByField = new Map<string, Topic[]>();
  for (const topic of topics) {
    const list = topicsByField.get(topic.field) ?? [];
    list.push(topic);
    topicsByField.set(topic.field, list);
  }

  const fieldByName = new Map(FIELDS.map((field) => [field.name, field]));

  // ---- Researchers -------------------------------------------------------

  const usedNames = new Set<string>();
  const researchers: Researcher[] = [];

  for (let index = 0; index < researcherCount; index += 1) {
    const seniority = weightedPick(
      rng,
      SENIORITY_WEIGHTS,
      ([, weight]) => weight,
    )[0];
    const [minYears, maxYears] = CAREER_LENGTH[seniority];
    const careerLength = intBetween(rng, minYears, maxYears);

    let name = "";
    do {
      name = `${pick(rng, GIVEN_NAMES)} ${pick(rng, FAMILY_NAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    researchers.push({
      id: padded("res", index),
      name,
      registryId: `RSR-${String(100000 + index * 7).slice(0, 6)}`,
      seniority,
      field: pick(rng, FIELDS).name,
      careerStart: CURRENT_YEAR - careerLength,
    });
  }

  // ---- Affiliations ------------------------------------------------------

  const affiliations: Affiliation[] = [];
  /** Institution ids a researcher has ever been at, for later reuse. */
  const institutionsOf = new Map<string, string[]>();

  for (const researcher of researchers) {
    const moves = researcher.careerStart <= CURRENT_YEAR - 12
      ? intBetween(rng, 2, 3)
      : intBetween(rng, 1, 2);

    const chosen = sample(rng, institutions, moves);
    const span = CURRENT_YEAR - researcher.careerStart;
    let cursor = researcher.careerStart;

    chosen.forEach((institution, moveIndex) => {
      const isLast = moveIndex === chosen.length - 1;
      const segment = Math.max(
        2,
        Math.round(span / chosen.length) + intBetween(rng, -1, 2),
      );
      const fromYear = cursor;
      const toYear = isLast ? null : Math.min(CURRENT_YEAR - 1, fromYear + segment);

      affiliations.push({
        researcherId: researcher.id,
        institutionId: institution.id,
        fromYear,
        toYear,
        role: roleForSegment(researcher.seniority, isLast),
      });

      cursor = (toYear ?? CURRENT_YEAR) + (chance(rng, 0.15) ? 1 : 0);
    });

    institutionsOf.set(
      researcher.id,
      chosen.map((institution) => institution.id),
    );
  }

  const currentInstitution = new Map<string, string>();
  for (const affiliation of affiliations) {
    if (affiliation.toYear === null) {
      currentInstitution.set(affiliation.researcherId, affiliation.institutionId);
    }
  }

  // ---- Supervision -------------------------------------------------------

  const supervisions: Supervision[] = [];
  const seniorEnough = researchers.filter((researcher) =>
    ["Professor", "Associate Professor", "Group Leader", "Emeritus Professor"].includes(
      researcher.seniority,
    ),
  );

  for (const researcher of researchers) {
    const isJunior =
      researcher.seniority === "PhD Student" ||
      researcher.seniority === "Postdoctoral Researcher";
    if (!isJunior) continue;

    // Prefer a supervisor who was at one of the same institutions.
    const shared = institutionsOf.get(researcher.id) ?? [];
    const candidates = seniorEnough.filter((candidate) => {
      if (candidate.id === researcher.id) return false;
      if (candidate.careerStart > researcher.careerStart - 6) return false;
      const theirs = institutionsOf.get(candidate.id) ?? [];
      return theirs.some((id) => shared.includes(id));
    });

    const pool = candidates.length > 0 ? candidates : seniorEnough;
    if (pool.length === 0) continue;

    const supervisor = pick(rng, pool);
    const fromYear = researcher.careerStart;
    supervisions.push({
      supervisorId: supervisor.id,
      superviseeId: researcher.id,
      fromYear,
      toYear: Math.min(CURRENT_YEAR, fromYear + intBetween(rng, 3, 5)),
      kind: researcher.seniority === "PhD Student" ? "Doctoral" : "Postdoctoral",
    });
  }

  // ---- Papers and co-authorship -----------------------------------------

  const papers: Paper[] = [];
  const authorships: Authorship[] = [];
  const paperTopics: Link[] = [];

  /** collaboration counts, keyed "a|b" with a < b. */
  const collaborationCount = new Map<string, number>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const topicCounts = new Map<string, Map<string, number>>();
  const noteTopic = (researcherId: string, topic: string) => {
    const counts = topicCounts.get(researcherId) ?? new Map<string, number>();
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
    topicCounts.set(researcherId, counts);
  };

  for (let index = 0; index < paperCount; index += 1) {
    // Publication years skew recent, matching a growing field.
    const year = aroundMean(rng, CURRENT_YEAR - 4, 4, CURRENT_YEAR - 12, CURRENT_YEAR);

    const eligible = researchers.filter((researcher) => researcher.careerStart <= year);
    if (eligible.length < 3) continue;

    const lead = pick(rng, eligible);
    const field = fieldByName.get(lead.field) ?? FIELDS[0];
    const leadInstitution = currentInstitution.get(lead.id);

    const coAuthorCount = Math.min(
      eligible.length - 1,
      aroundMean(rng, 4, 2, 1, 9),
    );

    const pool = eligible.filter((candidate) => candidate.id !== lead.id);
    const coAuthors: Researcher[] = [];
    const taken = new Set<string>([lead.id]);

    for (let slot = 0; slot < coAuthorCount; slot += 1) {
      const available = pool.filter((candidate) => !taken.has(candidate.id));
      if (available.length === 0) break;

      const chosen = weightedPick(rng, available, (candidate) => {
        const prior = collaborationCount.get(pairKey(lead.id, candidate.id)) ?? 0;
        const sameField = candidate.field === lead.field ? 2.5 : 0;
        const sameInstitution =
          leadInstitution && currentInstitution.get(candidate.id) === leadInstitution
            ? 3
            : 0;
        return 0.4 + prior * 3 + sameField + sameInstitution;
      });

      taken.add(chosen.id);
      coAuthors.push(chosen);
    }

    const paper: Paper = {
      id: padded("pap", index),
      title: makeTitle(rng, field),
      year,
      field: field.name,
      citations: Math.max(0, aroundMean(rng, 24, 30, 0, 400)),
    };
    papers.push(paper);

    const authors = [lead, ...coAuthors];
    // The senior-most author conventionally takes the last slot.
    const ordered = shuffle(rng, authors);
    ordered.forEach((author, position) => {
      authorships.push({
        researcherId: author.id,
        paperId: paper.id,
        position: position + 1,
        corresponding: author.id === lead.id,
      });
    });

    for (let a = 0; a < authors.length; a += 1) {
      for (let b = a + 1; b < authors.length; b += 1) {
        const key = pairKey(authors[a].id, authors[b].id);
        collaborationCount.set(key, (collaborationCount.get(key) ?? 0) + 1);
      }
    }

    const fieldTopics = topicsByField.get(field.name) ?? [];
    for (const topic of sample(rng, fieldTopics, intBetween(rng, 1, 3))) {
      paperTopics.push({ from: paper.id, to: topic.id });
      for (const author of authors) noteTopic(author.id, topic.id);
    }
  }

  // ---- Grants ------------------------------------------------------------

  const grants: Grant[] = [];
  const grantAwards: GrantAward[] = [];

  const grantEligible = researchers.filter(
    (researcher) =>
      researcher.seniority !== "PhD Student" &&
      researcher.seniority !== "Postdoctoral Researcher",
  );

  for (let index = 0; index < grantCount; index += 1) {
    if (grantEligible.length === 0) break;

    const principal = pick(rng, grantEligible);
    const field = fieldByName.get(principal.field) ?? FIELDS[0];
    const funder = pick(rng, funders);
    const startYear = intBetween(rng, CURRENT_YEAR - 10, CURRENT_YEAR - 1);
    const grant: Grant = {
      id: padded("grant", index, 3),
      reference: `${funder.shortName}-${startYear}-${String(1000 + index)}`,
      title: makeTitle(rng, field),
      programme: pick(rng, GRANT_PROGRAMMES),
      amountUsd: intBetween(rng, 3, 70) * 50_000,
      startYear,
      endYear: startYear + intBetween(rng, 3, 6),
      funderId: funder.id,
    };
    grants.push(grant);
    grantAwards.push({
      grantId: grant.id,
      researcherId: principal.id,
      role: "Principal Investigator",
    });

    const coInvestigatorCount = intBetween(rng, 0, 4);
    const taken = new Set<string>([principal.id]);
    for (let slot = 0; slot < coInvestigatorCount; slot += 1) {
      const available = researchers.filter(
        (candidate) =>
          !taken.has(candidate.id) && candidate.careerStart <= grant.startYear,
      );
      if (available.length === 0) break;

      const chosen = weightedPick(rng, available, (candidate) => {
        const prior = collaborationCount.get(pairKey(principal.id, candidate.id)) ?? 0;
        const sameField = candidate.field === principal.field ? 2 : 0;
        return 0.3 + prior * 2.5 + sameField;
      });
      taken.add(chosen.id);
      grantAwards.push({
        grantId: grant.id,
        researcherId: chosen.id,
        role: "Co-Investigator",
      });
    }
  }

  // ---- Expertise ---------------------------------------------------------

  const expertise: WeightedLink[] = [];
  for (const [researcherId, counts] of topicCounts) {
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [topic, count] of ranked) {
      expertise.push({ from: researcherId, to: topic, weight: count });
    }
  }

  // ---- Proposals under review -------------------------------------------

  const proposals: Proposal[] = [];
  const proposalApplicants: GeneratedWorld["proposalApplicants"] = [];
  const proposalTopics: Link[] = [];

  // Lead applicants should be people with a real publication record, otherwise
  // there is nothing for the conflict queries to traverse.
  const applicantPool = grantEligible.filter(
    (researcher) => (topicCounts.get(researcher.id)?.size ?? 0) >= 2,
  );

  const usedApplicants = new Set<string>();
  for (let index = 0; index < proposalCount; index += 1) {
    const available = applicantPool.filter(
      (researcher) => !usedApplicants.has(researcher.id),
    );
    if (available.length === 0) break;

    const lead = pick(rng, available);
    usedApplicants.add(lead.id);

    const field = fieldByName.get(lead.field) ?? FIELDS[0];
    const funder = pick(rng, funders);
    const leadTopics = [...(topicCounts.get(lead.id) ?? new Map())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    const proposal: Proposal = {
      id: padded("prop", index, 3),
      reference: `${funder.shortName}/${CURRENT_YEAR}/${String(index + 1).padStart(3, "0")}`,
      title: makeTitle(rng, field),
      summary: `${pick(rng, field.methods)} applied to ${pick(rng, field.objects)}, with a programme of work spanning ${intBetween(rng, 3, 5)} years.`,
      submittedYear: CURRENT_YEAR,
      requestedUsd: intBetween(rng, 4, 50) * 50_000,
      field: field.name,
      funderId: funder.id,
    };
    proposals.push(proposal);
    proposalApplicants.push({
      from: proposal.id,
      to: lead.id,
      role: "Lead Applicant",
    });

    for (const topic of leadTopics) {
      proposalTopics.push({ from: proposal.id, to: topic });
    }

    const coApplicantCount = intBetween(rng, 0, 2);
    const taken = new Set<string>([lead.id]);
    for (let slot = 0; slot < coApplicantCount; slot += 1) {
      const available = researchers.filter(
        (candidate) => !taken.has(candidate.id) && candidate.field === lead.field,
      );
      if (available.length === 0) break;
      const chosen = weightedPick(rng, available, (candidate) => {
        const prior = collaborationCount.get(pairKey(lead.id, candidate.id)) ?? 0;
        return 0.5 + prior * 3;
      });
      taken.add(chosen.id);
      proposalApplicants.push({
        from: proposal.id,
        to: chosen.id,
        role: "Co-Applicant",
      });
    }
  }

  return {
    institutions,
    funders,
    topics,
    researchers,
    affiliations,
    supervisions,
    papers,
    authorships,
    paperTopics,
    grants,
    grantAwards,
    expertise,
    proposals,
    proposalApplicants,
    proposalTopics,
  };
}

function roleForSegment(seniority: Seniority, isCurrent: boolean): string {
  if (isCurrent) return seniority;
  return seniority === "Professor" || seniority === "Emeritus Professor"
    ? "Associate Professor"
    : "Postdoctoral Researcher";
}
