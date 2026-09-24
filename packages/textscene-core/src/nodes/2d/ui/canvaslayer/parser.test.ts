import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseCanvasLayer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCanvasLayer', () => {
  it('parses name and layer index', () => {
    const p = parseCanvasLayer(h({ name: 'HUD', type: 'CanvasLayer' }), { layer: '2' });
    expect(p.name).toBe('HUD');
    expect(p.layer).toBe(2);
  });
  it('treats visible="false" as hidden and omits absent layer', () => {
    const p = parseCanvasLayer(h({ name: 'HUD', type: 'CanvasLayer' }), { visible: 'false' });
    expect(p.visible).toBe(false);
    expect(p.layer).toBeUndefined();
  });

  // Without the parent the node attaches to nothing, and a scene has exactly
  // one root, so the layer and its whole subtree vanish from the tree.
  it('carries the heading’s hierarchy attributes, so the layer stays in the tree', () => {
    const p = parseCanvasLayer(
      h({ name: 'HUD', type: 'CanvasLayer', parent: '.', index: '2' }),
      {}
    );
    expect(p.parent).toBe('.');
    expect(p.index).toBe(2);
  });

  it('keeps an instanced layer’s sub-scene reference', () => {
    const p = parseCanvasLayer(
      h({ name: 'HUD', parent: '.', instance: 'ExtResource("1_hud")' }),
      {}
    );
    expect(p.instance).toBe('ExtResource("1_hud")');
  });
});
