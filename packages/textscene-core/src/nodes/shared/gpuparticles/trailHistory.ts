/**
 * The last steps of each particle, which a trail section reads: section `k` of a particle that has run
 * `n` steps since its last start holds the state after step `max(1, n - sectionDelay(k))`
 * (`particles_storage.cpp:1164-1173`, `particles.glsl:285-330`). Written only by the settle loop.
 */

import type { GpuParticle } from './particle';

/** Floats of one state: the three basis columns, the origin, the velocity, the colour and the custom data. */
const STATE_FLOATS = 23;
const ORIGIN_AT = 9;
const VELOCITY_AT = 12;
const COLOR_AT = 15;
const CUSTOM_AT = 19;

/** The steps a section `k` of `sections` runs behind its particle: `floor(k * H / S)` for a history of `H` steps. */
function sectionDelay(section: number, historyDepth: number, sections: number): number {
  return Math.trunc((section * historyDepth) / sections);
}

/** The history of every particle slot. */
export interface TrailHistory {
  /** The steps of history, `H`, which place the sections. */
  depth: number;
  /** The states kept for each slot: `depth`, or fewer when the settle runs fewer steps. */
  ringSize: number;
  /** The steps each slot has run since its last start. */
  steps: Int32Array;
  /** Per slot, `ringSize` states in a ring addressed by step number. */
  states: Float32Array;
}

/**
 * A slot never runs more than `settleSteps` steps, so its ring holds `min(depth, settleSteps + 1)`
 * states: a `trail_lifetime` of 1e9 s allocates the steps it can use, not `depth`.
 */
export function startHistory(slotCount: number, depth: number, settleSteps: number): TrailHistory {
  const ringSize = Math.min(depth, settleSteps + 1);
  return {
    depth,
    ringSize,
    steps: new Int32Array(slotCount),
    states: new Float32Array(slotCount * ringSize * STATE_FLOATS),
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
  states.set(origin, at + ORIGIN_AT);
  states.set(velocity, at + VELOCITY_AT);
  states.set(color, at + COLOR_AT);
  states.set(custom, at + CUSTOM_AT);
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
    target.origin[axis] = states[at + ORIGIN_AT + axis]!;
    target.velocity[axis] = states[at + VELOCITY_AT + axis]!;
  }
  for (let axis = 0; axis < 4; axis++) {
    target.color[axis] = states[at + COLOR_AT + axis]!;
    target.custom[axis] = states[at + CUSTOM_AT + axis]!;
  }
}

function stateAt({ ringSize }: TrailHistory, slot: number, step: number): number {
  return (slot * ringSize + (step % ringSize)) * STATE_FLOATS;
}
