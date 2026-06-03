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
});
