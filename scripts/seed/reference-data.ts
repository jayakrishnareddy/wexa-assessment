/**
 * Reference data for the generated research community.
 *
 * Institutions and funders are real public organisations, which is what makes
 * the dataset feel like a real panel roster. Researchers are entirely
 * synthetic: the application renders conflict-of-interest findings about the
 * people in it, and attaching those findings to real, named academics would be
 * both misleading and unfair. Names are assembled from generic given/family
 * name pools; any resemblance to a specific researcher is coincidental.
 */

export interface InstitutionSeed {
  name: string;
  country: string;
  kind: "University" | "Research Institute" | "Hospital" | "National Lab";
}

export const INSTITUTIONS: readonly InstitutionSeed[] = [
  { name: "ETH Zürich", country: "Switzerland", kind: "University" },
  { name: "EPFL", country: "Switzerland", kind: "University" },
  { name: "University of Cambridge", country: "United Kingdom", kind: "University" },
  { name: "University of Oxford", country: "United Kingdom", kind: "University" },
  { name: "Imperial College London", country: "United Kingdom", kind: "University" },
  { name: "University of Edinburgh", country: "United Kingdom", kind: "University" },
  { name: "Francis Crick Institute", country: "United Kingdom", kind: "Research Institute" },
  { name: "Wellcome Sanger Institute", country: "United Kingdom", kind: "Research Institute" },
  { name: "Max Planck Institute for Intelligent Systems", country: "Germany", kind: "Research Institute" },
  { name: "Max Planck Institute of Biochemistry", country: "Germany", kind: "Research Institute" },
  { name: "Technical University of Munich", country: "Germany", kind: "University" },
  { name: "Heidelberg University", country: "Germany", kind: "University" },
  { name: "EMBL Heidelberg", country: "Germany", kind: "Research Institute" },
  { name: "Sorbonne Université", country: "France", kind: "University" },
  { name: "Institut Pasteur", country: "France", kind: "Research Institute" },
  { name: "INRIA", country: "France", kind: "Research Institute" },
  { name: "KTH Royal Institute of Technology", country: "Sweden", kind: "University" },
  { name: "Karolinska Institutet", country: "Sweden", kind: "Research Institute" },
  { name: "Delft University of Technology", country: "Netherlands", kind: "University" },
  { name: "Massachusetts Institute of Technology", country: "United States", kind: "University" },
  { name: "Stanford University", country: "United States", kind: "University" },
  { name: "University of California, Berkeley", country: "United States", kind: "University" },
  { name: "Harvard University", country: "United States", kind: "University" },
  { name: "Broad Institute", country: "United States", kind: "Research Institute" },
  { name: "Carnegie Mellon University", country: "United States", kind: "University" },
  { name: "Princeton University", country: "United States", kind: "University" },
  { name: "University of Washington", country: "United States", kind: "University" },
  { name: "Johns Hopkins University", country: "United States", kind: "University" },
  { name: "Lawrence Berkeley National Laboratory", country: "United States", kind: "National Lab" },
  { name: "Memorial Sloan Kettering Cancer Center", country: "United States", kind: "Hospital" },
  { name: "University of Toronto", country: "Canada", kind: "University" },
  { name: "Mila – Quebec AI Institute", country: "Canada", kind: "Research Institute" },
  { name: "University of British Columbia", country: "Canada", kind: "University" },
  { name: "RIKEN", country: "Japan", kind: "Research Institute" },
  { name: "University of Tokyo", country: "Japan", kind: "University" },
  { name: "Tsinghua University", country: "China", kind: "University" },
  { name: "Peking University", country: "China", kind: "University" },
  { name: "National University of Singapore", country: "Singapore", kind: "University" },
  { name: "Indian Institute of Science", country: "India", kind: "University" },
  { name: "Indian Institute of Technology Bombay", country: "India", kind: "University" },
  { name: "CSIR Institute of Genomics and Integrative Biology", country: "India", kind: "Research Institute" },
  { name: "University of Melbourne", country: "Australia", kind: "University" },
  { name: "Weizmann Institute of Science", country: "Israel", kind: "Research Institute" },
  { name: "KAIST", country: "South Korea", kind: "University" },
];

export interface FunderSeed {
  name: string;
  shortName: string;
  country: string;
  kind: "Government" | "Charity" | "Private Foundation" | "Supranational";
}

export const FUNDERS: readonly FunderSeed[] = [
  { name: "National Science Foundation", shortName: "NSF", country: "United States", kind: "Government" },
  { name: "National Institutes of Health", shortName: "NIH", country: "United States", kind: "Government" },
  { name: "European Research Council", shortName: "ERC", country: "European Union", kind: "Supranational" },
  { name: "Wellcome Trust", shortName: "Wellcome", country: "United Kingdom", kind: "Charity" },
  { name: "UK Research and Innovation", shortName: "UKRI", country: "United Kingdom", kind: "Government" },
  { name: "Deutsche Forschungsgemeinschaft", shortName: "DFG", country: "Germany", kind: "Government" },
  { name: "Swiss National Science Foundation", shortName: "SNSF", country: "Switzerland", kind: "Government" },
  { name: "Agence Nationale de la Recherche", shortName: "ANR", country: "France", kind: "Government" },
  { name: "Japan Society for the Promotion of Science", shortName: "JSPS", country: "Japan", kind: "Government" },
  { name: "Natural Sciences and Engineering Research Council", shortName: "NSERC", country: "Canada", kind: "Government" },
  { name: "Science and Engineering Research Board", shortName: "SERB", country: "India", kind: "Government" },
  { name: "Australian Research Council", shortName: "ARC", country: "Australia", kind: "Government" },
  { name: "Simons Foundation", shortName: "Simons", country: "United States", kind: "Private Foundation" },
  { name: "Chan Zuckerberg Initiative", shortName: "CZI", country: "United States", kind: "Private Foundation" },
  { name: "Human Frontier Science Program", shortName: "HFSP", country: "France", kind: "Supranational" },
];

export interface FieldSeed {
  name: string;
  topics: readonly string[];
  /** Fragments used to assemble plausible paper and proposal titles. */
  methods: readonly string[];
  objects: readonly string[];
}

export const FIELDS: readonly FieldSeed[] = [
  {
    name: "Machine Learning",
    topics: [
      "Representation Learning",
      "Probabilistic Inference",
      "Optimisation Theory",
      "Graph Neural Networks",
      "Interpretability",
      "Reinforcement Learning",
    ],
    methods: [
      "Contrastive pre-training",
      "Variational inference",
      "Sparse attention",
      "Curriculum scheduling",
      "Gradient flow analysis",
      "Low-rank adaptation",
    ],
    objects: [
      "long-context sequence models",
      "heterogeneous graphs",
      "offline policy evaluation",
      "distribution shift",
      "sample-efficient control",
      "model calibration",
    ],
  },
  {
    name: "Computational Genomics",
    topics: [
      "Variant Calling",
      "Single-Cell Transcriptomics",
      "Regulatory Genomics",
      "Population Genetics",
      "Long-Read Assembly",
      "Epigenomics",
    ],
    methods: [
      "Pangenome graph alignment",
      "Bayesian deconvolution",
      "Haplotype-aware phasing",
      "Transfer learning",
      "Diffusion-based imputation",
      "Ancestry-aware calibration",
    ],
    objects: [
      "structural variants in diverse cohorts",
      "single-cell chromatin accessibility",
      "rare-disease trio sequencing",
      "cis-regulatory element discovery",
      "somatic mosaicism",
      "polygenic risk transferability",
    ],
  },
  {
    name: "Neuroscience",
    topics: [
      "Systems Neuroscience",
      "Neural Decoding",
      "Connectomics",
      "Computational Psychiatry",
      "Neuroimaging Methods",
      "Synaptic Plasticity",
    ],
    methods: [
      "Two-photon imaging",
      "State-space modelling",
      "Electron-microscopy reconstruction",
      "Hierarchical Bayesian modelling",
      "Closed-loop stimulation",
      "Latent dynamics estimation",
    ],
    objects: [
      "cortical population dynamics",
      "hippocampal replay",
      "decision-making under uncertainty",
      "large-scale connectome wiring rules",
      "biomarkers of treatment response",
      "cross-species functional alignment",
    ],
  },
  {
    name: "Epidemiology & Public Health",
    topics: [
      "Infectious Disease Modelling",
      "Genomic Surveillance",
      "Health Equity",
      "Causal Inference",
      "Vaccine Effectiveness",
      "Environmental Health",
    ],
    methods: [
      "Compartmental modelling",
      "Phylodynamic inference",
      "Target trial emulation",
      "Wastewater surveillance",
      "Difference-in-differences estimation",
      "Agent-based simulation",
    ],
    objects: [
      "respiratory pathogen transmission",
      "antimicrobial resistance spread",
      "under-served urban populations",
      "waning immunity",
      "heat exposure and morbidity",
      "outbreak early-warning systems",
    ],
  },
  {
    name: "Structural Biology",
    topics: [
      "Cryo-EM",
      "Protein Design",
      "Molecular Dynamics",
      "Membrane Proteins",
      "Structure Prediction",
      "Drug Discovery",
    ],
    methods: [
      "Cryo-electron tomography",
      "Deep generative design",
      "Enhanced-sampling simulation",
      "Hydrogen-deuterium exchange",
      "Co-folding prediction",
      "Fragment-based screening",
    ],
    objects: [
      "GPCR signalling complexes",
      "de novo binder scaffolds",
      "allosteric regulation",
      "viral fusion machinery",
      "intrinsically disordered regions",
      "protein–ligand affinity",
    ],
  },
  {
    name: "Climate & Earth Systems",
    topics: [
      "Climate Modelling",
      "Carbon Cycle",
      "Extreme Events",
      "Remote Sensing",
      "Ocean Dynamics",
      "Cryosphere",
    ],
    methods: [
      "Kilometre-scale simulation",
      "Data assimilation",
      "Machine-learned emulation",
      "Satellite retrieval",
      "Attribution analysis",
      "Ensemble downscaling",
    ],
    objects: [
      "monsoon variability",
      "terrestrial carbon sinks",
      "compound flood risk",
      "ice-sheet mass loss",
      "marine heatwaves",
      "regional climate projections",
    ],
  },
];

/**
 * Generic given and family names drawn from a range of naming traditions, so
 * the synthetic roster looks like an international review panel. Combined at
 * random — the pairings are not real people.
 */
export const GIVEN_NAMES: readonly string[] = [
  "Aditi", "Alejandro", "Amara", "Anders", "Anika", "Arjun", "Astrid", "Ayaka",
  "Beatriz", "Bilal", "Camille", "Carlos", "Chen", "Chidi", "Clara", "Daniela",
  "Dmitri", "Ebba", "Elena", "Elias", "Emeka", "Esther", "Fatima", "Felix",
  "Gabriel", "Giulia", "Hannah", "Haruki", "Hugo", "Ibrahim", "Ines", "Isabel",
  "Jonas", "Juliana", "Kaito", "Karin", "Kwame", "Lars", "Laura", "Leila",
  "Liang", "Lucia", "Mahmoud", "Marta", "Mateo", "Mei", "Miriam", "Nadia",
  "Naledi", "Nikhil", "Noor", "Olivia", "Omar", "Pablo", "Priya", "Rafael",
  "Rania", "Ravi", "Rebecca", "Rin", "Rohan", "Sanne", "Sara", "Seo-yeon",
  "Simone", "Sofia", "Sven", "Tariq", "Thandiwe", "Theo", "Tomas", "Valeria",
  "Vikram", "Wei", "Yara", "Yuki", "Zainab", "Zoë",
];

export const FAMILY_NAMES: readonly string[] = [
  "Abadi", "Adeyemi", "Almeida", "Andersson", "Bakker", "Bellini", "Bergström",
  "Bhatt", "Blanchard", "Cardoso", "Chandrasekaran", "Chowdhury", "Dahl",
  "Delacroix", "Dubois", "Eriksen", "Faruqi", "Fernandes", "Fischer", "Gallo",
  "Ghosh", "Grunwald", "Haddad", "Hoffmann", "Ibarra", "Iyer", "Jansen",
  "Kaufmann", "Keller", "Khoury", "Kimura", "Kowalski", "Laurent", "Lindqvist",
  "Marchetti", "Mbeki", "Mendoza", "Moreau", "Nakamura", "Navarro", "Nkemelu",
  "Novak", "Okafor", "Oyelaran", "Pereira", "Petrov", "Rahman", "Ramaswamy",
  "Reinhardt", "Ricci", "Rossi", "Sandoval", "Santos", "Schneider", "Sharma",
  "Silva", "Sørensen", "Suzuki", "Takahashi", "Tanaka", "Thakur", "Vasquez",
  "Vermeulen", "Virtanen", "Wagner", "Wang", "Weber", "Yamada", "Yildirim",
  "Zhang", "Zhao", "Ziegler",
];

/** Grant programme names, paired with a funder at generation time. */
export const GRANT_PROGRAMMES: readonly string[] = [
  "Consolidator Grant",
  "Discovery Programme",
  "Frontier Research Award",
  "Collaborative Research Centre",
  "Investigator Award",
  "Strategic Priorities Fund",
  "Early Career Fellowship",
  "Synergy Grant",
  "Programme Grant",
  "Centre of Excellence",
];

export const SENIORITIES = [
  "PhD Student",
  "Postdoctoral Researcher",
  "Assistant Professor",
  "Associate Professor",
  "Professor",
  "Group Leader",
  "Emeritus Professor",
] as const;

export type Seniority = (typeof SENIORITIES)[number];
