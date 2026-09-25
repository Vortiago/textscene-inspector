/**
 * VScrollBar parser contract. VScrollBar declares no properties (`Range → ScrollBar →
 * VScrollBar`, only the draw axis differs), so this pins that the slice carries the Control,
 * Range and ScrollBar surface, which a slice wired to the wrong base would lose.
 */

import { describe, it, expect } from 'vitest';
import { parseVScrollBar } from './parser';

const heading = { type: 'node', attributes: { type: 'VScrollBar', name: 'Bar' } };

describe('parseVScrollBar', () => {
  it('parses the Control, Range and ScrollBar properties (happy path)', () => {
    const result = parseVScrollBar(heading, {
      layout_mode: '2',
      value: '30',
      min_value: '10',
      max_value: '110',
      page: '20',
      custom_step: '5',
    });
    expect(result.name).toBe('Bar');
    expect(result.layoutMode).toBe(2);
    expect(result.value).toBe(30);
    expect(result.minValue).toBe(10);
    expect(result.maxValue).toBe(110);
    expect(result.page).toBe(20);
    expect(result.customStep).toBe(5);
  });

  it('leaves a malformed value undefined rather than falling back to a number (error path)', () => {
    expect(parseVScrollBar(heading, { value: 'far' }).value).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseVScrollBar({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.value).toBeUndefined();
    expect(result.customStep).toBeUndefined();
  });
});
