/**
 * isRenderableNodeType — the tree/inspector "supported?" check. Render-only
 * synthesised types (GLBSceneRoot) must count as supported so they aren't
 * flagged "Not implemented" despite rendering.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: populate the component registry
import '../parser/TscnParser'; // side-effect: populate the parser registry
import { isRenderableNodeType, INTERNAL_DISPLAY_NODE_TYPES } from './nodeSupport';

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
