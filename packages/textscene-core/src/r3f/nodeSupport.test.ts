/**
 * isRenderableNodeType — the tree/inspector "supported?" check. Render-only
 * synthesised types (GLBSceneRoot) must count as supported so they aren't
 * flagged "Not implemented" despite rendering.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: populate the component registry
import '../parser/TscnParser'; // side-effect: populate the parser registry
import { nodeRegistry } from '../core/NodeRegistry';
import { isRenderableNodeType, rendersOwnVisual, INTERNAL_DISPLAY_NODE_TYPES } from './nodeSupport';

describe('isRenderableNodeType', () => {
  it('treats the render-only GLBSceneRoot as supported (it renders)', () => {
    expect(isRenderableNodeType('GLBSceneRoot')).toBe(true);
  });

  it('treats a parser-registered node type as supported', () => {
    expect(isRenderableNodeType('MeshInstance3D')).toBe(true);
  });

  it('treats the base Node as supported', () => {
    expect(isRenderableNodeType('Node')).toBe(true);
  });

  it('treats registered internal-display types as supported', () => {
    for (const t of INTERNAL_DISPLAY_NODE_TYPES) {
      expect(isRenderableNodeType(t)).toBe(true);
    }
  });

  it('flags a genuinely unknown type as unsupported', () => {
    expect(isRenderableNodeType('TotallyMadeUpNodeType')).toBe(false);
  });
});

/**
 * The badge's three-state. The case that matters is the middle one: a node that
 * draws nothing ON PURPOSE must not be reported as a gap, and a node that merely
 * parses must not be reported as rendering.
 */
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

  it('separates from isRenderableNodeType once a type is parsed but not drawn', () => {
    // The whole reason this function exists. `Window` is parsed and fully
    // validated, so `isRenderableNodeType` says yes; nothing draws it, so the
    // badge must still say "not implemented". Before this split, a parser
    // registration alone silently cleared that badge.
    expect(isRenderableNodeType('Window')).toBe(true);
    expect(rendersOwnVisual('Window')).toBe('not-implemented');
  });

  it('reports every registered type as one of the three states', () => {
    // Which types are pending changes every wave, so pinning the list here
    // would churn; the standing invariant is that no type falls through. The
    // status↔registry agreement is asserted per sheet in sheets.test.mjs.
    const states = new Set(nodeRegistry.getAllTypeNames().map(rendersOwnVisual));
    expect([...states].sort()).toEqual(['draws', 'not-implemented', 'transform-only']);
  });
});
