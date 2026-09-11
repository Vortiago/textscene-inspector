import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseGraphFrame } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseGraphFrame', () => {
  it('parses title, autoshrink_*, drag_margin, tint_color*', () => {
    const p = parseGraphFrame(h({ name: 'F', type: 'GraphFrame' }), {
      title: '"My Frame"',
      autoshrink_enabled: 'false',
      autoshrink_margin: '10',
      drag_margin: '20',
      tint_color_enabled: 'true',
      tint_color: 'Color(0.5, 0.5, 0.5, 1)',
    });
    expect(p.title).toBe('My Frame');
    expect(p.autoshrinkEnabled).toBe(false);
    expect(p.autoshrinkMargin).toBe(10);
    expect(p.dragMargin).toBe(20);
    expect(p.tintColorEnabled).toBe(true);
    expect(p.tintColor).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
  });

  it('leaves every member undefined when absent', () => {
    const p = parseGraphFrame(h({ name: 'F', type: 'GraphFrame' }), {});
    expect(p.title).toBeUndefined();
    expect(p.autoshrinkEnabled).toBeUndefined();
    expect(p.autoshrinkMargin).toBeUndefined();
    expect(p.dragMargin).toBeUndefined();
    expect(p.tintColorEnabled).toBeUndefined();
    expect(p.tintColor).toBeUndefined();
  });
});
