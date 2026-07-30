/**
 * VSlider parser contract. VSlider declares no properties of its own — it is
 * `Range → Slider → VSlider` with only the draw axis differing — so this pins
 * that the slice really does carry the Control + Range + Slider surface
 * through, which is the failure mode of a slice wired to the wrong base.
 */
import { describe, it, expect } from 'vitest';
import { parseVSlider } from './parser';

const heading = { type: 'node', attributes: { type: 'VSlider', name: 'Level' } };

describe('parseVSlider', () => {
  it('parses the Control, Range and Slider properties (happy path)', () => {
    const result = parseVSlider(heading, {
      layout_mode: '1',
      anchors_preset: '11',
      value: '75',
      editable: 'false',
    });
    expect(result.name).toBe('Level');
    expect(result.anchorsPreset).toBe(11);
    expect(result.value).toBe(75);
    expect(result.editable).toBe(false);
  });

  it('leaves a malformed max_value undefined rather than falling back (error path)', () => {
    expect(parseVSlider(heading, { max_value: 'high' }).maxValue).toBeUndefined();
  });

  it('parses the acceptance scene’s VSlider, whose only Range property is step', () => {
    const result = parseVSlider(heading, { layout_mode: '1', anchors_preset: '11', step: '0.0' });
    expect(result.step).toBe(0);
    expect(result.value).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseVSlider({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.editable).toBeUndefined();
  });
});
