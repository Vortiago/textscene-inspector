/**
 * The last steps of each particle, which a trail section reads: section `k` of a particle that has run
 * `n` steps since its last start holds the state after step `max(1, n - sectionDelay(k))`
 * (`particles_storage.cpp:1164-1173`, `particles.glsl:285-330`). Written only by the settle loop.
 */

import type { GpuParticle } from './particle';

/** Floats of one state: the three basis columns, the origin, the velocity, the colour and the custom data. */
const STATE_FLOATS = 23;

/** The steps a section `k` of `sections` runs behind its particle: `floor(k * H / S)` for a history of `H` steps. */
export function sectionDelay(section: number, historyDepth: number, sections: number): number {
  return Math.trunc((section * historyDepth) / sections);
}

/** The history of every particle slot. */
export interface TrailHistory {
  /** The steps kept for each slot. */
  depth: number;
  /** The steps each slot has run since its last start. */
  steps: Int32Array;
  /** Per slot, `depth` states in a ring addressed by step number. */
  states: Float32Array;
}

export function startHistory(slotCount: number, depth: number): TrailHistory {
  return {
    depth,
    steps: new Int32Array(slotCount),
    states: new Float32Array(slotCount * depth * STATE_FLOATS),
  };
}

/** A restart resets every section of the slot. */
export function restartHistory(history: TrailHistory, slot: number): void {
  history.steps[slot] = 0;
}

/** Keeps the state of `particle` after the step it just ran. */
export function recordStep(history: TrailHistory, slot: number, particle: GpuParticle): void {
  const step = ++history.steps[slot]!;
  const at = stateAt(history, slot, step);
  const { states } = history;
  const { columns, origin, velocity, color, custom } = particle;
  for (let column = 0; column < 3; column++) states.set(columns[column]!, at + column * 3);
  states.set(origin, at + 9);
  states.set(velocity, at + 12);
  states.set(color, at + 15);
  states.set(custom, at + 19);
}

/**
 * Writes section `section` of `sections` of a live slot into `target`, a scratch particle that the
 * caller reuses for every section.
 */
export function readSection(
  history: TrailHistory,
  slot: number,
  section: number,
  sections: number,
  target: GpuParticle
): void {
  const step = Math.max(1, history.steps[slot]! - sectionDelay(section, history.depth, sections));
  const at = stateAt(history, slot, step);
  const { states } = history;
  for (let column = 0; column < 3; column++) {
    for (let axis = 0; axis < 3; axis++) target.columns[column]![axis] = states[at + column * 3 + axis]!;
  }
  for (let axis = 0; axis < 3; axis++) {
    target.origin[axis] = states[at + 9 + axis]!;
    target.velocity[axis] = states[at + 12 + axis]!;
  }
  for (let axis = 0; axis < 4; axis++) {
    target.color[axis] = states[at + 15 + axis]!;
    target.custom[axis] = states[at + 19 + axis]!;
  }
}

function stateAt({ depth }: TrailHistory, slot: number, step: number): number {
  return (slot * depth + (step % depth)) * STATE_FLOATS;
}
