/** The shared crossed-range warning: one diagnostic per crossed pair, under the caller's prefix. */
import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { paramMinAboveMaxDiagnostics } from './particleParamRanges.js';

const node = { name: 'Fx', type: 'CPUParticles2D' } as TscnNode;

describe('paramMinAboveMaxDiagnostics', () => {
  it('reports a crossed pair as a warning under the given prefix', () => {
    expect(paramMinAboveMaxDiagnostics(node, { angle_min: '10', angle_max: '-10' }, 'cpuparticles2d')).toEqual([
      {
        severity: 'warning',
        message:
          "'angle_min' 10 is above 'angle_max' -10. Godot applies them in the order the file lists them, so 'angle_min' loads as -10.",
        nodeName: 'Fx',
        nodeType: 'CPUParticles2D',
        ruleName: 'cpuparticles2d-param-min-above-max',
      },
    ]);
  });

  it('names stored values in their shortest single-precision text', () => {
    const [diagnostic] = paramMinAboveMaxDiagnostics(node, { damping_min: '0.3', damping_max: '0.1' }, 'x');
    expect(diagnostic?.message).toContain("'damping_min' 0.3 is above 'damping_max' 0.1");
  });

  it('reports nothing for a range that is not crossed', () => {
    expect(paramMinAboveMaxDiagnostics(node, { angle_min: '-10', angle_max: '10' }, 'x')).toEqual([]);
  });
});
