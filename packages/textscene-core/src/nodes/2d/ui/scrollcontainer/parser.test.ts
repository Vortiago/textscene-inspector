import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseScrollContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseScrollContainer', () => {
  it('parses the base Control layout', () => {
    const p = parseScrollContainer(h({ name: 'Scroll', type: 'ScrollContainer' }), {
      anchors_preset: '15',
      anchor_right: '1.0',
      anchor_bottom: '1.0',
    });
    expect(p.name).toBe('Scroll');
    expect(p.anchorsPreset).toBe(15);
    expect(p.anchorRight).toBe(1);
  });

  it('inherits Control layout (custom_minimum_size still flows through)', () => {
    const p = parseScrollContainer(h({ name: 'Scroll', type: 'ScrollContainer' }), {
      custom_minimum_size: 'Vector2(200, 120)',
    });
    expect(p.customMinimumSize).toEqual({ x: 200, y: 120 });
  });

  it('parses horizontal/vertical_scroll_mode (#31)', () => {
    const p = parseScrollContainer(h({ name: 'Scroll', type: 'ScrollContainer' }), {
      horizontal_scroll_mode: '0',
      vertical_scroll_mode: '2',
    });
    expect(p.horizontalScrollMode).toBe(0);
    expect(p.verticalScrollMode).toBe(2);
  });

  it('leaves scroll modes undefined when absent', () => {
    const p = parseScrollContainer(h({ name: 'Scroll', type: 'ScrollContainer' }), {});
    expect(p.horizontalScrollMode).toBeUndefined();
    expect(p.verticalScrollMode).toBeUndefined();
  });
});
