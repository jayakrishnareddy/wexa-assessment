import type { Metadata } from "next";
import { CONFLICT_RULES } from "@/lib/domain";
import { SchemaDiagram } from "@/components/schema-diagram";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Data model",
  description:
    "The labelled nodes, typed relationships and conflict rules behind the " +
    "reviewer screening.",
};

const NODES: Array<{ label: string; description: string; properties: string }> = [
  {
    label: "Researcher",
    description: "A person who publishes, holds grants and may review.",
    properties: "id, name, nameLower, registryId, seniority, field, careerStart",
  },
  {
    label: "Paper",
    description: "A publication. Co-authorship is inferred through it.",
    properties: "id, title, year, field, citations",
  },
  {
    label: "Institution",
    description: "A university, institute, hospital or national lab.",
    properties: "id, name, country, kind",
  },
  {
    label: "Grant",
    description: "An award held jointly by one or more researchers.",
    properties: "id, reference, title, programme, amountUsd, startYear, endYear",
  },
  {
    label: "Funder",
    description: "The body that awards grants and runs review panels.",
    properties: "id, name, shortName, country, kind",
  },
  {
    label: "Proposal",
    description: "A submission awaiting reviewer assignment.",
    properties: "id, reference, title, summary, submittedYear, requestedUsd, field",
  },
  {
    label: "Topic",
    description: "A research subfield, used to match expertise to a proposal.",
    properties: "id, name, field",
  },
];

const RELATIONSHIPS: Array<{
  type: string;
  from: string;
  to: string;
  properties: string;
  note?: string;
}> = [
  {
    type: "AUTHORED",
    from: "Researcher",
    to: "Paper",
    properties: "position, corresponding",
  },
  {
    type: "AFFILIATED_WITH",
    from: "Researcher",
    to: "Institution",
    properties: "fromYear, toYear, role",
    note: "toYear is null while the post is current",
  },
  {
    type: "SUPERVISED",
    from: "Researcher",
    to: "Researcher",
    properties: "fromYear, toYear, kind",
  },
  {
    type: "AWARDED_TO",
    from: "Grant",
    to: "Researcher",
    properties: "role",
  },
  {
    type: "FUNDED_BY",
    from: "Grant · Proposal",
    to: "Funder",
    properties: "—",
    note: "the Proposal edge is omitted from the diagram for legibility",
  },
  {
    type: "SUBMITTED_BY",
    from: "Proposal",
    to: "Researcher",
    properties: "role",
  },
  {
    type: "ABOUT",
    from: "Paper · Proposal",
    to: "Topic",
    properties: "—",
  },
  {
    type: "EXPERT_IN",
    from: "Researcher",
    to: "Topic",
    properties: "weight",
    note: "derived from the topics of the papers they authored",
  },
];

export default function ModelPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Data model</h1>
        <p className="text-muted mt-2 leading-relaxed">
          Seven labelled node types and eight typed relationships. Every
          conflict rule is a short traversal over this shape — which is the
          reason the application is built on a graph database rather than a set
          of join tables.
        </p>
      </div>

      <Card className="p-6 mb-8">
        <SchemaDiagram />
      </Card>

      <section className="mb-10">
        <h2 className="text-sm font-semibold tracking-tight mb-3">Node labels</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-subtle border-b border-border-subtle">
                <th className="py-2 pr-4 font-medium">Label</th>
                <th className="py-2 pr-4 font-medium">Represents</th>
                <th className="py-2 font-medium">Properties</th>
              </tr>
            </thead>
            <tbody>
              {NODES.map((node) => (
                <tr key={node.label} className="border-b border-border-subtle/60">
                  <td className="py-2.5 pr-4 font-medium whitespace-nowrap">
                    {node.label}
                  </td>
                  <td className="py-2.5 pr-4 text-muted">{node.description}</td>
                  <td className="py-2.5 font-mono text-[11px] text-subtle">
                    {node.properties}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold tracking-tight mb-3">
          Relationship types
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-subtle border-b border-border-subtle">
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">From → To</th>
                <th className="py-2 font-medium">Properties</th>
              </tr>
            </thead>
            <tbody>
              {RELATIONSHIPS.map((relationship) => (
                <tr
                  key={relationship.type}
                  className="border-b border-border-subtle/60 align-top"
                >
                  <td className="py-2.5 pr-4 font-mono text-[11px] whitespace-nowrap">
                    {relationship.type}
                  </td>
                  <td className="py-2.5 pr-4 text-muted whitespace-nowrap">
                    {relationship.from} → {relationship.to}
                  </td>
                  <td className="py-2.5">
                    <span className="font-mono text-[11px] text-subtle">
                      {relationship.properties}
                    </span>
                    {relationship.note ? (
                      <span className="block text-[11px] text-subtle mt-0.5">
                        {relationship.note}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-tight mb-3">
          Conflict rules
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {CONFLICT_RULES.map((rule) => (
            <Card key={rule.id} className="p-4">
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${
                    rule.severity === "blocking" ? "bg-blocked" : "bg-caution"
                  }`}
                />
                <span className="text-sm font-medium">{rule.label}</span>
                <span
                  className={`ml-auto text-[10px] uppercase tracking-wide font-medium ${
                    rule.severity === "blocking" ? "text-blocked" : "text-caution"
                  }`}
                >
                  {rule.severity}
                </span>
              </div>
              <p className="text-[13px] text-muted mt-1.5 leading-snug">
                {rule.description}
              </p>
              <p className="text-[11px] text-subtle mt-1">{rule.window}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
