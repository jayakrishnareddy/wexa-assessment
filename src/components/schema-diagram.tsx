const WIDTH = 780;
const HEIGHT = 460;

interface Box {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

const BOX_W = 132;
const BOX_H = 44;

const BOXES: Box[] = [
  { id: "Proposal", label: "Proposal", x: 96, y: 52, w: BOX_W, h: BOX_H, color: "var(--node-researcher)" },
  { id: "Topic", label: "Topic", x: 660, y: 52, w: 108, h: BOX_H, color: "var(--node-paper)" },
  { id: "Researcher", label: "Researcher", x: 330, y: 196, w: BOX_W, h: BOX_H, color: "var(--node-researcher)" },
  { id: "Paper", label: "Paper", x: 660, y: 196, w: 108, h: BOX_H, color: "var(--node-paper)" },
  { id: "Institution", label: "Institution", x: 96, y: 330, w: BOX_W, h: BOX_H, color: "var(--node-institution)" },
  { id: "Grant", label: "Grant", x: 356, y: 392, w: 108, h: BOX_H, color: "var(--node-grant)" },
  { id: "Funder", label: "Funder", x: 660, y: 330, w: 108, h: BOX_H, color: "var(--node-institution)" },
];

interface Edge {
  from: string;
  to: string;
  label: string;
  /** Nudges the label off the line when two edges cross near their midpoints. */
  offset?: [number, number];
}

const EDGES: Edge[] = [
  { from: "Proposal", to: "Researcher", label: "SUBMITTED_BY" },
  { from: "Proposal", to: "Topic", label: "ABOUT", offset: [0, -8] },
  { from: "Researcher", to: "Paper", label: "AUTHORED" },
  { from: "Researcher", to: "Topic", label: "EXPERT_IN", offset: [10, -10] },
  { from: "Researcher", to: "Institution", label: "AFFILIATED_WITH" },
  { from: "Paper", to: "Topic", label: "ABOUT" },
  { from: "Grant", to: "Researcher", label: "AWARDED_TO", offset: [-16, 0] },
  { from: "Grant", to: "Funder", label: "FUNDED_BY" },
];

const BY_ID = new Map(BOXES.map((box) => [box.id, box]));

/**
 * Clips a centre-to-centre line at each box's border.
 *
 * Computing the endpoints beats hand-placing them: the arrowheads land exactly
 * on the edge of every box, and moving a box needs no other change.
 */
function clip(from: Box, to: Box) {
  const fromCx = from.x + from.w / 2;
  const fromCy = from.y + from.h / 2;
  const toCx = to.x + to.w / 2;
  const toCy = to.y + to.h / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  const scale = (box: Box) => {
    const sx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
    const sy = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
    return Math.min(sx, sy);
  };

  const start = scale(from);
  // Leave a small gap so the arrowhead does not touch the border.
  const end = scale(to) * 1.0;

  return {
    x1: fromCx + dx * start,
    y1: fromCy + dy * start,
    x2: toCx - dx * end,
    y2: toCy - dy * end,
  };
}

export function SchemaDiagram({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`w-full h-auto ${className}`}
      role="img"
      aria-label="Graph schema: labelled nodes and the typed relationships between them"
    >
      <defs>
        <marker
          id="schema-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
        </marker>
      </defs>

      {EDGES.map((edge) => {
        const from = BY_ID.get(edge.from);
        const to = BY_ID.get(edge.to);
        if (!from || !to) return null;

        const { x1, y1, x2, y2 } = clip(from, to);
        const midX = (x1 + x2) / 2 + (edge.offset?.[0] ?? 0);
        const midY = (y1 + y2) / 2 + (edge.offset?.[1] ?? 0);
        const width = edge.label.length * 5.6 + 10;

        return (
          <g key={`${edge.from}-${edge.to}-${edge.label}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--border-strong)"
              strokeWidth={1.4}
              markerEnd="url(#schema-arrow)"
            />
            <rect
              x={midX - width / 2}
              y={midY - 8}
              width={width}
              height={16}
              rx={3}
              fill="var(--background)"
            />
            <text
              x={midX}
              y={midY + 3.5}
              textAnchor="middle"
              fontSize={9.5}
              className="fill-[var(--muted)]"
              style={{ fontFamily: "var(--font-geist-mono), monospace" }}
            >
              {edge.label}
            </text>
          </g>
        );
      })}

      {/* SUPERVISED is a self-relationship, drawn as a loop above Researcher. */}
      <SupervisedLoop box={BY_ID.get("Researcher")!} />

      {BOXES.map((box) => (
        <g key={box.id}>
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={9}
            fill="var(--surface)"
            stroke={box.color}
            strokeWidth={1.6}
          />
          <circle cx={box.x + 15} cy={box.y + box.h / 2} r={4} fill={box.color} />
          <text
            x={box.x + 27}
            y={box.y + box.h / 2 + 4}
            fontSize={12.5}
            fontWeight={600}
            className="fill-[var(--foreground)]"
          >
            {box.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function SupervisedLoop({ box }: { box: Box }) {
  const cx = box.x + box.w / 2;
  const top = box.y;

  return (
    <g>
      <path
        d={`M ${cx - 26} ${top} C ${cx - 40} ${top - 44}, ${cx + 40} ${top - 44}, ${cx + 26} ${top}`}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={1.4}
        markerEnd="url(#schema-arrow)"
      />
      <rect x={cx - 38} y={top - 40} width={76} height={16} rx={3} fill="var(--background)" />
      <text
        x={cx}
        y={top - 28.5}
        textAnchor="middle"
        fontSize={9.5}
        className="fill-[var(--muted)]"
        style={{ fontFamily: "var(--font-geist-mono), monospace" }}
      >
        SUPERVISED
      </text>
    </g>
  );
}
