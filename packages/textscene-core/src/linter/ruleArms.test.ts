/**
 * The contract that makes a factory's two halves one declaration.
 */

import { describe, expect, it } from 'vitest';
import { armEmits, reportArm, type RuleArm, type RuleArms } from './ruleArms.js';
import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';

const node: TscnNode = { name: 'Cast', type: 'ShapeCast2D', properties: {}, children: [] };

const present: RuleArm = {
  severity: 'warning',
  ruleName: 'shapecast2d-zero-mask',
  grounding: { kind: 'engine-inert', at: 'godot_space_2d.cpp:44', unused: 'nothing matches' },
};

describe('armEmits', () => {
  it('declares every arm the instance carries, in declaration order', () => {
    const arms: RuleArms<'a' | 'b'> = { a: present, b: { ...present, ruleName: 'second' } };
    expect(armEmits(arms).map((e) => e.ruleName)).toEqual(['shapecast2d-zero-mask', 'second']);
  });

  it('declares nothing for an arm this instance does not carry', () => {
    // The conditional spread that omits an arm is the ONLY gate; `emits` cannot
    // disagree with `check` about it because both read this same record.
    const arms: RuleArms<'a' | 'b'> = { a: present };
    expect(armEmits(arms).map((e) => e.ruleName)).toEqual(['shapecast2d-zero-mask']);
  });
});

describe('reportArm', () => {
  it('reports the arm at its declared severity and name', () => {
    const into: Diagnostic[] = [];
    reportArm(into, present, node, 'the mask is zero');
    expect(into).toEqual([
      {
        severity: 'warning',
        message: 'the mask is zero',
        nodeName: 'Cast',
        nodeType: 'ShapeCast2D',
        ruleName: 'shapecast2d-zero-mask',
      },
    ]);
  });

  it('says nothing for an arm this instance does not carry', () => {
    // The silence is the fix: an undeclared arm reported anyway is exactly the
    // divergence no emits guard can see.
    const into: Diagnostic[] = [];
    reportArm(into, undefined, node, 'the mask is zero');
    expect(into).toEqual([]);
  });
});
