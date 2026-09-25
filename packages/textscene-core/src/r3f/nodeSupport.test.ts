/**
 * `rendersOwnVisual`: a node that draws nothing on purpose is not a gap, and a
 * node that merely parses is not rendering.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: populate the component registry
import '../parser/TscnParser'; // side-effect: populate the parser registry
import { nodeRegistry } from '../core/NodeRegistry';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { INSTANCE_PLACEHOLDER_TYPE } from '../godot/packedScene.js';
import { rendersOwnVisual } from './nodeSupport';

describe('rendersOwnVisual', () => {
  it('reports an instance_placeholder heading as drawing nothing by design', () => {
    // `NodeRegistry.ts:114` types such a heading `InstancePlaceholder`, which no
    // slice registers. Godot builds it with no children (`packed_scene.cpp:255`)
    // and draws nothing until `create_instance`, so the node is finished.
    expect(rendersOwnVisual(INSTANCE_PLACEHOLDER_TYPE)).toBe('transform-only');
  });

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
    // `Window` is parsed and validated, and nothing draws it, so the badge says
    // "not implemented". A parser registration alone never clears it.
    expect(nodeRegistry.getRegistration('Window')).not.toBeNull();
    expect(rendersOwnVisual('Window')).toBe('not-implemented');
  });

  it('reports every registered type as one of the three states', () => {
    // The pending list moves, so the invariant is that no type falls through.
    // sheets.test.mjs asserts the status and registry agree per sheet.
    const KNOWN = ['draws', 'not-implemented', 'transform-only'];
    const states = [...new Set(nodeRegistry.getAllTypeNames().map(rendersOwnVisual))];
    expect(states.filter((s) => !KNOWN.includes(s))).toEqual([]);

    expect(states).toContain('draws');
    expect(states).toContain('transform-only');
  });

  it('reports every declared gap as not-implemented, whatever it registered', () => {
    // Derived from the registry, so it stays non-vacuous while any remain. A
    // pending slice registers a base component, so the answer comes from the
    // declared intent, and this pins that early return.
    const pending = nodeRegistry
      .getAllTypeNames()
      .filter((type) => nodeComponentRegistry.renderIntentOf(type) === 'pending');
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.filter((type) => rendersOwnVisual(type) !== 'not-implemented')).toEqual([]);
  });
});
