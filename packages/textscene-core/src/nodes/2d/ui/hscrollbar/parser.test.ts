/**
 * HScrollBar parser contract. HScrollBar declares no property, so this pins
 * that the Control, Range and ScrollBar properties pass through: a slice wired
 * to the wrong base loses them.
 */
import { describe, it, expect } from 'vitest';
import { parseHScrollBar } from './parser';

const heading = { type: 'node', attributes: { type: 'HScrollBar', name: 'Bar' } };

describe('parseHScrollBar', () => {
  it('parses the Control, Range and ScrollBar properties (happy path)', () => {
    const result = parseHScrollBar(heading, {
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
    expect(parseHScrollBar(heading, { value: 'far' }).value).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseHScrollBar({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.value).toBeUndefined();
    expect(result.customStep).toBeUndefined();
  });
});
