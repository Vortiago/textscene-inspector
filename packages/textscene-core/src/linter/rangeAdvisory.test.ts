/**
 * Unit tests for the Range advisory combinator. Deliberately SYNTHETIC — no real
 * slice's data — so this covers the mechanics (presence, parse, NaN, direction,
 * floor, shared/distinct names) once, decoupled from any node type's bounds. Each
 * slice's own accept/reject tables keep asserting its real messages and rule names.
 */

import { describe, it, expect } from 'vitest';
import { rangeAdvisories, type RangeAdvisoryTable } from './rangeAdvisory.js';
import type { TscnNode } from '../parser/types.js';

function nodeWith(properties: Record<string, string>): TscnNode {
  return { name: 'Test', type: 'TestNode', children: [], properties };
}

describe('rangeAdvisories', () => {
  it('returns [] when properties are not a record', () => {
    const node = { name: 'N', type: 'T', children: [], properties: null as unknown as Record<string, string> };
    expect(rangeAdvisories(node, { x: [{ over: 10, ruleName: 'r', message: () => 'm' }] })).toEqual([]);
  });

  it('skips a property that is absent from the node', () => {
    const node = nodeWith({ other: '999' });
    expect(rangeAdvisories(node, { x: [{ over: 10, ruleName: 'r', message: () => 'm' }] })).toEqual([]);
  });

  it('skips a non-numeric value', () => {
    const node = nodeWith({ x: 'not-a-number' });
    expect(rangeAdvisories(node, { x: [{ over: 10, ruleName: 'r', message: () => 'm' }] })).toEqual([]);
  });

  describe('over arm', () => {
    const table: RangeAdvisoryTable = { x: [{ over: 10, ruleName: 'x-over', message: (v) => `x is ${v}` }] };

    it('trips strictly above the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '11' }), table)).toHaveLength(1);
    });
    it('stays silent at the bound (strict)', () => {
      expect(rangeAdvisories(nodeWith({ x: '10' }), table)).toEqual([]);
    });
    it('stays silent below the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '9' }), table)).toEqual([]);
    });
  });

  describe('under arm', () => {
    const table: RangeAdvisoryTable = { x: [{ under: 5, ruleName: 'x-under', message: (v) => `x is ${v}` }] };

    it('trips strictly below the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '4' }), table)).toHaveLength(1);
    });
    it('stays silent at the bound (strict)', () => {
      expect(rangeAdvisories(nodeWith({ x: '5' }), table)).toEqual([]);
    });
  });

  describe('floor on an under arm', () => {
    const table: RangeAdvisoryTable = { x: [{ under: 1, floor: 0, ruleName: 'x-tiny', message: (v) => `x is ${v}` }] };

    it('trips between the floor and the bound', () => {
      expect(rangeAdvisories(nodeWith({ x: '0.5' }), table)).toHaveLength(1);
    });
    it('is suppressed at the floor', () => {
      expect(rangeAdvisories(nodeWith({ x: '0' }), table)).toEqual([]);
    });
    it('is suppressed below the floor', () => {
      expect(rangeAdvisories(nodeWith({ x: '-3' }), table)).toEqual([]);
    });
  });

  describe('two-sided property', () => {
    it('shares one rule name across both arms', () => {
      const table: RangeAdvisoryTable = {
        x: [
          { under: 0.1, ruleName: 'x-extreme', message: (v) => `low ${v}` },
          { over: 5, ruleName: 'x-extreme', message: (v) => `high ${v}` },
        ],
      };
      const low = rangeAdvisories(nodeWith({ x: '0.05' }), table);
      const high = rangeAdvisories(nodeWith({ x: '9' }), table);
      expect(low).toHaveLength(1);
      expect(low[0]?.ruleName).toBe('x-extreme');
      expect(high).toHaveLength(1);
      expect(high[0]?.ruleName).toBe('x-extreme');
      expect(rangeAdvisories(nodeWith({ x: '1' }), table)).toEqual([]);
    });

    it('carries distinct rule names per arm', () => {
      const table: RangeAdvisoryTable = {
        x: [
          { under: 0.1, ruleName: 'x-small', message: () => 'small' },
          { over: 5, ruleName: 'x-large', message: () => 'large' },
        ],
      };
      expect(rangeAdvisories(nodeWith({ x: '0.05' }), table)[0]?.ruleName).toBe('x-small');
      expect(rangeAdvisories(nodeWith({ x: '9' }), table)[0]?.ruleName).toBe('x-large');
    });
  });

  it('emits one diagnostic per tripped property across a multi-property table', () => {
    const table: RangeAdvisoryTable = {
      a: [{ over: 10, ruleName: 'a', message: () => 'a' }],
      b: [{ under: 5, ruleName: 'b', message: () => 'b' }],
    };
    const diagnostics = rangeAdvisories(nodeWith({ a: '11', b: '4' }), table);
    expect(diagnostics.map((d) => d.ruleName).sort()).toEqual(['a', 'b']);
  });

  it('emits a warning carrying the node identity and a message built from the parsed value', () => {
    const table: RangeAdvisoryTable = {
      x: [{ over: 10, ruleName: 'x-over', message: (v) => `x is ${v}` }],
    };
    const [diagnostic] = rangeAdvisories(nodeWith({ x: '12.50' }), table);
    expect(diagnostic).toEqual({
      severity: 'warning',
      message: 'x is 12.5',
      nodeName: 'Test',
      nodeType: 'TestNode',
      ruleName: 'x-over',
    });
  });
});
