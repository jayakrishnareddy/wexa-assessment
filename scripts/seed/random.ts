/**
 * Deterministic pseudo-randomness.
 *
 * The seed script must produce byte-identical data on every run: the README
 * quotes specific researchers and conflict paths, and a reviewer re-running
 * `npm run seed` should land on exactly the graph those examples describe.
 * `Math.random()` cannot give us that, so we use mulberry32 — small, fast, and
 * good enough for generating plausible-looking data.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max], inclusive. */
export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() called with an empty list");
  return items[Math.floor(rng() * items.length)];
}

/** Fisher–Yates on a copy; the input is left untouched. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** `count` distinct items, or the whole list if it is shorter. */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, Math.min(count, items.length));
}

/**
 * Picks one item with probability proportional to its weight.
 *
 * Used for preferential attachment when choosing co-authors: researchers who
 * already collaborate a lot are more likely to collaborate again, which is what
 * gives the generated graph realistic clustering instead of uniform noise.
 */
export function weightedPick<T>(
  rng: Rng,
  items: readonly T[],
  weightOf: (item: T) => number,
): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
  if (total <= 0) return pick(rng, items);

  let threshold = rng() * total;
  for (const item of items) {
    threshold -= Math.max(0, weightOf(item));
    if (threshold <= 0) return item;
  }
  return items[items.length - 1];
}

/** Draws roughly normally-distributed values, clamped to [min, max]. */
export function aroundMean(
  rng: Rng,
  mean: number,
  spread: number,
  min: number,
  max: number,
): number {
  const sum = rng() + rng() + rng();
  const centred = (sum - 1.5) / 1.5;
  return Math.max(min, Math.min(max, Math.round(mean + centred * spread)));
}
