/**
 * HSlider parser contract. HSlider declares no property, so this pins that the
 * Control, Range and Slider properties pass through: a slice wired to the wrong
 * base loses them.
 */
import { describe, it, expect } from 'vitest';
import { parseHSlider } from './parser';

const heading = { type: 'node', attributes: { type: 'HSlider', name: 'Volume' } };

describe('parseHSlider', () => {
  it('parses the Control, Range and Slider properties (happy path)', () => {
    const result = parseHSlider(heading, {
      layout_mode: '2',
      value: '30',
      min_value: '10',
      max_value: '110',
      tick_count: '3',
    });
    expect(result.name).toBe('Volume');
    expect(result.layoutMode).toBe(2);
    expect(result.value).toBe(30);
    expect(result.minValue).toBe(10);
    expect(result.maxValue).toBe(110);
    expect(result.tickCount).toBe(3);
  });

  it('leaves a malformed value undefined rather than falling back to a number (error path)', () => {
    expect(parseHSlider(heading, { value: 'loud' }).value).toBeUndefined();
  });

  it('parses the acceptance scene’s HSlider, whose only properties are step and ticks_on_borders', () => {
    const result = parseHSlider(heading, { layout_mode: '2', step: '0.0', ticks_on_borders: 'true' });
    expect(result.step).toBe(0);
    expect(result.ticksOnBorders).toBe(true);
    // Unset: the defaults (0, 0, 100) put the grabber at the low end.
    expect(result.value).toBeUndefined();
    expect(result.tickCount).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseHSlider({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.value).toBeUndefined();
  });
});
