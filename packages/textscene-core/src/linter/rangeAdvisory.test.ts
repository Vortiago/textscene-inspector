/**
 * The Range advisory combinator on synthetic tables, so the mechanics (presence,
 * parse, NaN, direction, floor, the reporting arm) are covered once. Each slice's
 * own tables assert its real messages and rule names.
 */

import { describe, it, expect } from 'vitest';
import { rangeAdvisories, type RangeAdvisoryTable, type WarningArm } from './rangeAdvisory.js';
import type { TscnNode } from '../parser/types.js';

const arm: WarningArm = {
  severity: 'warning',
  ruleName: 'x-extreme',
  grounding: { kind: 'engine', at: 'light_3d.cpp:389' },
};

function nodeWith(properties: Record<string, string>): TscnNode {
  return { name: 'Test', type: 'TestNode', children: [], properties };
}

describe('rangeAdvisories', () => {
  it('returns [] when properties are not a record', () => {
    const node = {
      name: 'N',
      type: 'T',
      children: [],
      properties: null as unknown as Record<string, string>,
    };
    expect(
      rangeAdvisories(node, { x: [{ over: 10, message: () => 'm', cite: 'light_3d.cpp:389' }] }, arm)
    ).toEqual([]);
  });

  it('skips a property that is absent from the node', () => {
    const node = nodeWith({ other: '999' });
    expect(
      rangeAdvisories(node, { x: [{ over: 10, message: () => 'm', cite: 'light_3d.cpp:389' }] }, arm)
    ).toEqual([]);
  });

  it('skips a non-numeric value', () => {
    const node = nodeWith({ x: 'not-a-number' });
    expect(
      rangeAdvisories(node, { x: [{ over: 10, message: () => 'm', cite: 'light_3d.cpp:389' }] }, arm)
    ).toEqual([]);
  });

  describe('over threshold', () => {
    const table: RangeAdvisoryTable = {
      x: [{ over: 10, message: (v) => `x is ${v}`, cite: 'light_3d.cpp:389' }],
    };

    // `inf` is a legal literal Godot stores unaltered (variant_parser.cpp:150-155),
    // and it is above every bound. `parseFloat` reads it as NaN, which the
    // non-numeric guard drops.
    it('trips on inf, which is above every bound', () => {
      expect(rangeAdvisories(nodeWith({ x: 'inf' }), table, arm)).toHaveLength(1);
    });

    it('stays silent on nan, whose every comparison is false', () => {
      expect(rangeAdvisories(nodeWith({ x: 'nan' }), table, arm)).toEqual([]);
    });

    it('trips strictly above the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '11' }), table, arm)).toHaveLength(1);
    });
    it('stays silent at the bound (strict)', () => {
      expect(rangeAdvisories(nodeWith({ x: '10' }), table, arm)).toEqual([]);
    });
    it('stays silent below the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '9' }), table, arm)).toEqual([]);
    });
  });

  describe('under threshold', () => {
    const table: RangeAdvisoryTable = {
      x: [{ under: 5, message: (v) => `x is ${v}`, cite: 'light_3d.cpp:389' }],
    };

    it('trips strictly below the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '4' }), table, arm)).toHaveLength(1);
    });
    it('stays silent at the bound (strict)', () => {
      expect(rangeAdvisories(nodeWith({ x: '5' }), table, arm)).toEqual([]);
    });
  });

  describe('floor on an under threshold', () => {
    const table: RangeAdvisoryTable = {
      x: [{ under: 1, floor: 0, message: (v) => `x is ${v}`, cite: 'light_3d.cpp:389' }],
    };

    it('trips between the floor and the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '0.5' }), table, arm)).toHaveLength(1);
    });
    it('is suppressed at the floor', () => {
      expect(rangeAdvisories(nodeWith({ x: '0' }), table, arm)).toEqual([]);
    });
    it('is suppressed below the floor', () => {
      expect(rangeAdvisories(nodeWith({ x: '-3' }), table, arm)).toEqual([]);
    });
  });

  describe('two-sided property', () => {
    it('reports both thresholds through the one arm', () => {
      const table: RangeAdvisoryTable = {
        x: [
          { under: 0.1, message: (v) => `low ${v}`, cite: 'light_3d.cpp:389' },
          { over: 5, message: (v) => `high ${v}`, cite: 'light_3d.cpp:389' },
        ],
      };
      const low = rangeAdvisories(nodeWith({ x: '0.05' }), table, arm);
      const high = rangeAdvisories(nodeWith({ x: '9' }), table, arm);
      expect([...low, ...high]).toBeAllAtTier('warning');
      expect(low).toMatchObject([{ ruleName: 'x-extreme', message: 'low 0.05' }]);
      expect(high).toMatchObject([{ ruleName: 'x-extreme', message: 'high 9' }]);
      expect(rangeAdvisories(nodeWith({ x: '1' }), table, arm)).toEqual([]);
    });
  });

  it('emits one diagnostic per tripped property across a multi-property table', () => {
    const table: RangeAdvisoryTable = {
      a: [{ over: 10, message: () => 'a', cite: 'light_3d.cpp:389' }],
      b: [{ under: 5, message: () => 'b', cite: 'light_3d.cpp:389' }],
    };
    const diagnostics = rangeAdvisories(nodeWith({ a: '11', b: '4' }), table, arm);
    expect(diagnostics.map((d) => d.message).sort()).toEqual(['a', 'b']);
  });

  it('emits a warning carrying the node identity and a message built from the parsed value', () => {
    const table: RangeAdvisoryTable = {
      x: [{ over: 10, message: (v) => `x is ${v}`, cite: 'light_3d.cpp:389' }],
    };
    const [diagnostic] = rangeAdvisories(nodeWith({ x: '12.50' }), table, arm);
    expect(diagnostic).toBeAtTier('warning');
    expect(diagnostic).toEqual({
      severity: 'warning',
      message: 'x is 12.5',
      nodeName: 'Test',
      nodeType: 'TestNode',
      ruleName: 'x-extreme',
    });
  });
});
