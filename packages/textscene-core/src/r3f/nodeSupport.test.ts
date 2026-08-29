/**
 * `rendersOwnVisual` — the tree/inspector badge's three-state. The case that
 * matters is the middle one: a node that draws nothing ON PURPOSE must not be
 * reported as a gap, and a node that merely parses must not be reported as
 * rendering.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: populate the component registry
import '../parser/TscnParser'; // side-effect: populate the parser registry
import { nodeRegistry } from '../core/NodeRegistry';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { rendersOwnVisual } from './nodeSupport';

describe('rendersOwnVisual', () => {
  it('reports a node with real geometry as drawing', () => {
    expect(rendersOwnVisual('MeshInstance3D')).toBe('draws');
  });

  it('reports a deliberately invisible node as transform-only, not a gap', () => {
    expect(rendersOwnVisual('Timer')).toBe('transform-only');
    expect(rendersOwnVisual('RemoteTransform3D')).toBe('transform-only');
  });

  it('reports an unknown type as not-implemented', () => {
    expect(rendersOwnVisual('TotallyMadeUpNodeType')).toBe('not-implemented');
  });

  it('reports Control types as drawing even though their registry is lazy', () => {
    // controlComponentRegistry is empty until the 2D overlay mounts, so this
    // must come from TWO_D_UI_TYPES or every Control reads as unimplemented in
    // 3D mode.
    expect(rendersOwnVisual('Button')).toBe('draws');
    expect(rendersOwnVisual('Label')).toBe('draws');
  });

  it('reports the synthesised GLB root as drawing', () => {
    expect(rendersOwnVisual('GLBSceneRoot')).toBe('draws');
  });

  it('reports a parsed-but-undrawn type as not-implemented', () => {
    // The whole reason this function exists: `Window` is parsed and fully
    // validated, and nothing draws it, so the badge must still say "not
    // implemented". A parser registration alone must never clear it.
    expect(nodeRegistry.getRegistration('Window')).not.toBeNull();
    expect(rendersOwnVisual('Window')).toBe('not-implemented');
  });

  it('reports every registered type as one of the three states', () => {
    // Which types are pending changes every wave, so pinning the list here
    // would churn; the standing invariant is that no type falls through. The
    // status↔registry agreement is asserted per sheet in sheets.test.mjs.
    const KNOWN = ['draws', 'not-implemented', 'transform-only'];
    const states = [...new Set(nodeRegistry.getAllTypeNames().map(rendersOwnVisual))];
    expect(states.filter((s) => !KNOWN.includes(s))).toEqual([]);

    expect(states).toContain('draws');
    expect(states).toContain('transform-only');
  });

  it('reports every declared gap as not-implemented, whatever it registered', () => {
    // Derived from the registry rather than pinned, so it stays true as types
    // move out of the bucket and stays non-vacuous while any remain. A pending
    // slice DOES register a base component, so the answer cannot come from the
    // absence of a registration: it has to come from the declared intent, and
    // that early return is what this pins.
    const pending = nodeRegistry
      .getAllTypeNames()
      .filter((type) => nodeComponentRegistry.renderIntentOf(type) === 'pending');
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.filter((type) => rendersOwnVisual(type) !== 'not-implemented')).toEqual([]);
  });
});
