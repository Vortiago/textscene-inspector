/** The shared crossed-range warning: one diagnostic per crossed pair, under the caller's arm. */
import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { paramMinAboveMaxArm, paramMinAboveMaxDiagnostics } from './particleParamRanges.js';

const node = { name: 'Fx', type: 'CPUParticles2D' } as TscnNode;
const arm = paramMinAboveMaxArm('cpuparticles2d', 'cpu_particles_2d.cpp:352-376');

describe('paramMinAboveMaxArm', () => {
  it('declares the warning under the prefix, grounded at the cited setter', () => {
    expect(arm).toEqual({
      severity: 'warning',
      ruleName: 'cpuparticles2d-param-min-above-max',
      grounding: { kind: 'engine', at: 'cpu_particles_2d.cpp:352-376' },
    });
  });
});

describe('paramMinAboveMaxDiagnostics', () => {
  it('reports a crossed pair through the arm', () => {
    expect(paramMinAboveMaxDiagnostics(node, { angle_min: '10', angle_max: '-10' }, arm)).toEqual([
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
    const [diagnostic] = paramMinAboveMaxDiagnostics(node, { damping_min: '0.3', damping_max: '0.1' }, arm);
    expect(diagnostic?.message).toContain("'damping_min' 0.3 is above 'damping_max' 0.1");
  });

  it('reports nothing for a range that is not crossed', () => {
    expect(paramMinAboveMaxDiagnostics(node, { angle_min: '-10', angle_max: '10' }, arm)).toEqual([]);
  });
});
