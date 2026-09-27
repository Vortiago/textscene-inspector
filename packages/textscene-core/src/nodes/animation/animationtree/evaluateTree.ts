/**
 * Evaluates a resolved AnimationTree (`AnimNode` graph) at the `parameters/*` values saved in the
 * `.tscn`, as the Godot editor's Animation panel does, into a blend program: clips with weights and
 * time scales. Godot's blend math at a clip-weight approximation, without Blend2's per-bone filters:
 * a clip on several paths sums their weights, and a clip whose weight rounds to zero is dropped.
 */

import type { AnimNode } from './treeResources';
import { unquoteLiteral } from '../../../parser/utils';
import { parseGodotFloat } from '../../../godot/number.js';

export interface ClipWeight {
  clip: string;
  weight: number;
  timeScale: number;
}

export type BlendProgram = ClipWeight[];

const WEIGHT_EPSILON = 1e-4;

export function evaluateTree(
  root: AnimNode | null,
  parameters: Record<string, string>
): BlendProgram {
  if (!root) return [];
  return mergeByClip(evaluate(root, parameters, 1, 1));
}

/**
 * Accumulate `{clip, weight, timeScale}` contributions for `node`, scaling by
 * the inherited `weight` / `timeScale` from ancestor blends. Parameter keys are
 * the BlendTree-local node name (for example `gun/blend_amount`). Nested-graph
 * parameter scoping is not modelled.
 */
function evaluate(
  node: AnimNode | null,
  params: Record<string, string>,
  weight: number,
  timeScale: number
): ClipWeight[] {
  if (!node || weight <= WEIGHT_EPSILON) return [];

  switch (node.kind) {
    case 'animation':
      return [{ clip: node.clip, weight, timeScale }];

    case 'blend2': {
      const amount = clamp01(numberParam(params, `${node.name}/blend_amount`, 0));
      return [
        ...evaluate(node.in0, params, weight * (1 - amount), timeScale),
        ...evaluate(node.in1, params, weight * amount, timeScale),
      ];
    }

    case 'add2': {
      // Additive blend: Godot's add_amount is not a [0,1] lerp, so it is not capped
      // at 1. It floors at 0, since a negative additive weight means nothing here.
      const amount = Math.max(0, numberParam(params, `${node.name}/add_amount`, 0));
      return [
        ...evaluate(node.base, params, weight, timeScale),
        ...evaluate(node.add, params, weight * amount, timeScale),
      ];
    }

    case 'timescale': {
      const scale = numberParam(params, `${node.name}/scale`, 1);
      return evaluate(node.input, params, weight, timeScale * scale);
    }

    case 'statemachine': {
      // Godot scopes the saved state under the node name (`<name>/current_state`);
      // a top-level tree_root state machine has no name (bare `current_state`).
      const key = node.name ? `${node.name}/current_state` : 'current_state';
      const current = stringParam(params, key) ?? node.startState;
      const state = node.states.find((s) => s.name === current) ?? node.states[0];
      return state ? evaluate(state.node, params, weight, timeScale) : [];
    }

    case 'passthrough':
      return evaluate(node.input, params, weight, timeScale);
  }
}

/** Sum weights of identical clips; the higher-weight path's timeScale wins. */
function mergeByClip(contributions: ClipWeight[]): BlendProgram {
  const byClip = new Map<string, ClipWeight>();
  for (const c of contributions) {
    const existing = byClip.get(c.clip);
    if (!existing) {
      byClip.set(c.clip, { ...c });
    } else {
      if (c.weight > existing.weight) existing.timeScale = c.timeScale;
      existing.weight += c.weight;
    }
  }
  return [...byClip.values()].filter((c) => c.weight > WEIGHT_EPSILON);
}

function numberParam(
  params: Record<string, string>,
  key: string,
  fallback: number
): number {
  const raw = params[key];
  if (raw === undefined) return fallback;
  // Non-finite as well as unreadable: `inf`/`nan` are legal float spellings, and
  // a NaN blend weight fails every `> EPSILON` test downstream, so the tree
  // renders nothing where the default would have rendered the base clip.
  const parsed = parseGodotFloat(raw);
  return parsed === null || !Number.isFinite(parsed) ? fallback : parsed;
}

function stringParam(params: Record<string, string>, key: string): string | null {
  const raw = params[key];
  return raw === undefined ? null : unquoteLiteral(raw.trim());
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
