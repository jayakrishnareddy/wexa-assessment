"use client";

import { useMemo } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { GraphData, GraphNode, GraphNodeType } from "@/lib/types";

const WIDTH = 760;
const HEIGHT = 420;

const NODE_COLOR: Record<GraphNodeType, string> = {
  Researcher: "var(--node-researcher)",
  Paper: "var(--node-paper)",
  Grant: "var(--node-grant)",
  Institution: "var(--node-institution)",
  Funder: "var(--node-institution)",
  Proposal: "var(--node-researcher)",
  Topic: "var(--node-paper)",
};

const RADIUS: Record<GraphNodeType, number> = {
  Researcher: 13,
  Paper: 9,
  Grant: 10,
  Institution: 11,
  Funder: 10,
  Proposal: 13,
  Topic: 8,
};

interface LayoutNode extends SimulationNodeDatum, GraphNode {}
type LayoutLink = SimulationLinkDatum<LayoutNode> & { id: string; label?: string };

/**
 * Renders the evidence behind a conflict verdict.
 *
 * The layout is computed once, synchronously, rather than animated: these
 * graphs are small (rarely more than twenty nodes) and a settled, stable
 * picture is easier to read and to screenshot than one that drifts. Running
 * the simulation to completion before the first paint also means no layout
 * shift.
 */
export function ConflictGraph({
  data,
  className = "",
}: {
  data: GraphData;
  className?: string;
}) {
  const layout = useMemo(() => {
    const nodes: LayoutNode[] = data.nodes.map((node) => ({ ...node }));
    const links: LayoutLink[] = data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
    }));

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<LayoutNode, LayoutLink>(links)
          .id((node) => node.id)
          .distance(110)
          .strength(0.7),
      )
      .force("charge", forceManyBody().strength(-700))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collide", forceCollide<LayoutNode>((node) => RADIUS[node.type] + 26))
      .stop();

    // d3-force seeds initial positions deterministically, so ticking to
    // convergence here gives the same picture on every render and on the server.
    simulation.tick(400);

    // Fit the viewBox to what was actually laid out. Without this a two- or
    // three-node graph — the common case for a single conflict — sits in the
    // middle of a fixed canvas surrounded by empty space, rendering almost
    // unreadably small inside the detail panel. Padding leaves room for the
    // labels, which hang below each node.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const radius = RADIUS[node.type];
      minX = Math.min(minX, (node.x ?? 0) - radius);
      maxX = Math.max(maxX, (node.x ?? 0) + radius);
      minY = Math.min(minY, (node.y ?? 0) - radius);
      // Label and sublabel sit below the node.
      maxY = Math.max(maxY, (node.y ?? 0) + radius + (node.sublabel ? 30 : 18));
    }

    const padX = 70;
    const padY = 24;
    let x = minX - padX;
    let y = minY - padY;
    let width = maxX - minX + padX * 2;
    let height = maxY - minY + padY * 2;

    // Keep a floor on the extents so a sparse graph does not zoom in so far
    // that the labels turn into headlines.
    const MIN_WIDTH = 460;
    const MIN_HEIGHT = 260;
    if (width < MIN_WIDTH) {
      x -= (MIN_WIDTH - width) / 2;
      width = MIN_WIDTH;
    }
    if (height < MIN_HEIGHT) {
      y -= (MIN_HEIGHT - height) / 2;
      height = MIN_HEIGHT;
    }

    return { nodes, links, viewBox: `${x} ${y} ${width} ${height}` };
  }, [data]);

  if (data.nodes.length <= 2 && data.edges.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-border-strong bg-surface-muted/40 px-6 py-10 text-center ${className}`}
      >
        <p className="text-sm text-muted">
          No connecting path found between these two researchers.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <svg
        viewBox={layout.viewBox}
        // Capped so the fitted viewBox renders at roughly its natural scale on
        // a wide page; it still shrinks to fit the narrower detail panel.
        style={{ maxWidth: 560 }}
        className="w-full h-auto mx-auto"
        role="img"
        aria-label="Graph showing the records that connect the two researchers"
      >
        <g>
          {layout.links.map((link) => {
            const source = link.source as LayoutNode;
            const target = link.target as LayoutNode;
            if (source.x == null || target.x == null) return null;

            const midX = ((source.x ?? 0) + (target.x ?? 0)) / 2;
            const midY = ((source.y ?? 0) + (target.y ?? 0)) / 2;

            return (
              <g key={link.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="var(--border-strong)"
                  strokeWidth={1.5}
                />
                {link.label ? (
                  <text
                    x={midX}
                    y={midY - 5}
                    textAnchor="middle"
                    className="fill-[var(--subtle)]"
                    fontSize={10}
                  >
                    {link.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        <g>
          {layout.nodes.map((node) => {
            const radius = RADIUS[node.type];
            const isEndpoint = node.role === "applicant" || node.role === "candidate";

            return (
              <g key={node.id} transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}>
                <title>
                  {node.label}
                  {node.sublabel ? ` — ${node.sublabel}` : ""}
                </title>

                {isEndpoint ? (
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke={NODE_COLOR[node.type]}
                    strokeWidth={1.5}
                    opacity={0.35}
                  />
                ) : null}

                <circle
                  r={radius}
                  fill={NODE_COLOR[node.type]}
                  opacity={isEndpoint ? 1 : 0.85}
                />

                <text
                  y={radius + 14}
                  textAnchor="middle"
                  fontSize={12.5}
                  className="fill-[var(--foreground)]"
                  fontWeight={isEndpoint ? 600 : 400}
                >
                  {truncate(node.label, node.type === "Paper" ? 34 : 26)}
                </text>

                {node.sublabel ? (
                  <text
                    y={radius + 26}
                    textAnchor="middle"
                    fontSize={10.5}
                    className="fill-[var(--subtle)]"
                  >
                    {truncate(node.sublabel, 30)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      <Legend nodes={data.nodes} />
    </div>
  );
}

function Legend({ nodes }: { nodes: GraphNode[] }) {
  const present = Array.from(new Set(nodes.map((node) => node.type)));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 px-1">
      {present.map((type) => (
        <span key={type} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="size-2 rounded-full"
            style={{ background: NODE_COLOR[type] }}
          />
          {type}
        </span>
      ))}
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
