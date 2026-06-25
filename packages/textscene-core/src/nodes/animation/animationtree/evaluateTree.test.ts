/**
 * Blend-program evaluation tests.
 *
 * `evaluateTree` walks a resolved `AnimNode` graph at the AnimationTree's
 * AUTHORED `parameters/*` state (a static previewer has no game script to
 * drive them) and produces the per-clip weights + time scales to feed the
 * mixer. Godot's blend math at a clip-weight approximation:
 *   Blend2:  out = in0·(1−amount) + in1·amount
 *   Add2:    out = base + add·amount
 *   TimeScale multiplies the playback rate of its input.
 */

import { describe, it, expect } from 'vitest';
import { evaluateTree } from './evaluateTree';
import { resolveTreeRoot, type AnimNode } from './treeResources';
import type { TscnInternalResource } from '../../../parser/types';

const leaf = (clip: string): AnimNode => ({ kind: 'animation', clip });

describe('evaluateTree — leaf', () => {
  it('plays a single clip at full weight and unit time scale', () => {
    expect(evaluateTree(leaf('idle'), {})).toEqual([
      { clip: 'idle', weight: 1, timeScale: 1 },
    ]);
  });

  it('returns an empty program for a null tree', () => {
    expect(evaluateTree(null, {})).toEqual([]);
  });
});

describe('evaluateTree — Blend2', () => {
  const tree = (): AnimNode => ({
    kind: 'blend2',
    name: 'mix',
    filtered: false,
    in0: leaf('idle'),
    in1: leaf('walk'),
  });

  it('plays only input 0 at the default blend_amount of 0', () => {
    expect(evaluateTree(tree(), {})).toEqual([{ clip: 'idle', weight: 1, timeScale: 1 }]);
  });

  it('splits weight by blend_amount', () => {
    expect(evaluateTree(tree(), { 'mix/blend_amount': '0.25' })).toEqual([
      { clip: 'idle', weight: 0.75, timeScale: 1 },
      { clip: 'walk', weight: 0.25, timeScale: 1 },
    ]);
  });

  it('clamps blend_amount above 1 to full input 1', () => {
    expect(evaluateTree(tree(), { 'mix/blend_amount': '2' })).toEqual([
      { clip: 'walk', weight: 1, timeScale: 1 },
    ]);
  });
});

describe('evaluateTree — Add2', () => {
  it('keeps the base at full weight and scales the additive input', () => {
    const node: AnimNode = { kind: 'add2', name: 'gun', base: leaf('idle'), add: leaf('shoot') };
    expect(evaluateTree(node, { 'gun/add_amount': '0.5' })).toEqual([
      { clip: 'idle', weight: 1, timeScale: 1 },
      { clip: 'shoot', weight: 0.5, timeScale: 1 },
    ]);
  });
});

describe('evaluateTree — TimeScale', () => {
  it('multiplies the time scale of its input', () => {
    const node: AnimNode = { kind: 'timescale', name: 'scale', input: leaf('run') };
    expect(evaluateTree(node, { 'scale/scale': '1.5' })).toEqual([
      { clip: 'run', weight: 1, timeScale: 1.5 },
    ]);
  });
});

describe('evaluateTree — StateMachine', () => {
  const sm: AnimNode = {
    kind: 'statemachine',
    name: '',
    startState: 'idle',
    states: [
      { name: 'idle', node: leaf('idle') },
      { name: 'walk', node: leaf('walk') },
    ],
  };

  it('plays the start state when no current_state is authored', () => {
    expect(evaluateTree(sm, {})).toEqual([{ clip: 'idle', weight: 1, timeScale: 1 }]);
  });

  it('honors an authored current_state parameter (top-level, bare key)', () => {
    expect(evaluateTree(sm, { current_state: '&"walk"' })).toEqual([
      { clip: 'walk', weight: 1, timeScale: 1 },
    ]);
  });

  it('scopes current_state under the node name when nested in a blend tree', () => {
    const nested: AnimNode = {
      kind: 'statemachine',
      name: 'sm',
      startState: 'idle',
      states: [
        { name: 'idle', node: leaf('idle') },
        { name: 'walk', node: leaf('walk') },
      ],
    };
    // Godot writes `parameters/sm/current_state`; the bare key must NOT match.
    expect(evaluateTree(nested, { 'sm/current_state': '&"walk"' })).toEqual([
      { clip: 'walk', weight: 1, timeScale: 1 },
    ]);
    expect(evaluateTree(nested, { current_state: '&"walk"' })).toEqual([
      { clip: 'idle', weight: 1, timeScale: 1 }, // falls back to startState
    ]);
  });
});

describe('evaluateTree — duplicate clip merging', () => {
  it('sums the weights of the same clip reached through two paths', () => {
    const node: AnimNode = {
      kind: 'blend2',
      name: 'mix',
      filtered: false,
      in0: leaf('idle'),
      in1: leaf('idle'),
    };
    expect(evaluateTree(node, { 'mix/blend_amount': '0.5' })).toEqual([
      { clip: 'idle', weight: 1, timeScale: 1 },
    ]);
  });
});

describe('evaluateTree — platformer blend tree (real fixture)', () => {
  function res(id: string, type: string, data: Record<string, unknown>): TscnInternalResource {
    return { id, type, data };
  }

  // SubResource 23 from scenes/demos/3d/platformer/player/player.tscn, verbatim.
  const resources: TscnInternalResource[] = [
    res('13', 'AnimationNodeAnimation', { animation: '&"run"' }),
    res('14', 'AnimationNodeAnimation', { animation: '&"jump"' }),
    res('15', 'AnimationNodeAnimation', { animation: '&"falling"' }),
    res('16', 'AnimationNodeAnimation', { animation: '&"shooting_standing"' }),
    res('AnimationNodeAnimation_jij26', 'AnimationNodeAnimation', { animation: '&"walk"' }),
    res('17', 'AnimationNodeAnimation', { animation: '&"idle"' }),
    res('18', 'AnimationNodeBlend2', {}),
    res('19', 'AnimationNodeBlend2', { filter_enabled: 'true' }),
    res('22', 'AnimationNodeBlend2', {}),
    res('20', 'AnimationNodeTimeScale', {}),
    res('AnimationNodeBlend2_lxtyk', 'AnimationNodeBlend2', {}),
    res('AnimationNodeBlend2_bivc5', 'AnimationNodeBlend2', {}),
    res('23', 'AnimationNodeBlendTree', {
      'nodes/Animation/node': 'SubResource("17")',
      'nodes/Animation 2/node': 'SubResource("13")',
      'nodes/Animation 3/node': 'SubResource("14")',
      'nodes/Animation 4/node': 'SubResource("15")',
      'nodes/Animation 5/node': 'SubResource("16")',
      'nodes/Animation 6/node': 'SubResource("AnimationNodeAnimation_jij26")',
      'nodes/air_dir/node': 'SubResource("18")',
      'nodes/gun/node': 'SubResource("19")',
      'nodes/run/node': 'SubResource("22")',
      'nodes/scale/node': 'SubResource("20")',
      'nodes/speed/node': 'SubResource("AnimationNodeBlend2_lxtyk")',
      'nodes/state/node': 'SubResource("AnimationNodeBlend2_bivc5")',
      node_connections:
        '[&"output", 0, &"gun", &"air_dir", 0, &"Animation 3", &"air_dir", 1, &"Animation 4", &"gun", 0, &"state", &"gun", 1, &"Animation 5", &"run", 0, &"Animation", &"run", 1, &"speed", &"scale", 0, &"run", &"speed", 0, &"Animation 6", &"speed", 1, &"Animation 2", &"state", 0, &"scale", &"state", 1, &"air_dir"]',
    }),
  ];

  const authoredParams = {
    'air_dir/blend_amount': '0.0',
    'gun/blend_amount': '0.0',
    'run/blend_amount': '0.0',
    'scale/scale': '1.5',
    'speed/blend_amount': '0.0',
    'state/blend_amount': '0.0',
  };

  it('resolves and evaluates to idle at 1.5x with the authored parameter state', () => {
    const root = resolveTreeRoot('SubResource("23")', resources);
    expect(evaluateTree(root, authoredParams)).toEqual([
      { clip: 'idle', weight: 1, timeScale: 1.5 },
    ]);
  });

  it('switches to the run clip when the run/speed branch is driven up (runtime parity)', () => {
    const root = resolveTreeRoot('SubResource("23")', resources);
    const program = evaluateTree(root, { ...authoredParams, 'run/blend_amount': '1.0', 'speed/blend_amount': '1.0' });
    // run(1.0) → speed(1.0) → Animation 2 (run clip); gun/state still 0 so this branch reaches output.
    expect(program).toEqual([{ clip: 'run', weight: 1, timeScale: 1.5 }]);
  });
});
