import { describe, expect, it } from 'vitest';
import { parsePathFollow2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';

function heading(name = 'Follow'): ParsedHeading {
  return { type: 'node', attributes: { type: 'PathFollow2D', name } };
}

describe('parsePathFollow2D', () => {
  it('defaults rotates/cubic_interp/loop to true and offsets to 0', () => {
    const props = parsePathFollow2D(heading(), {});
    expect(props.rotates).toBe(true);
    expect(props.cubic_interp).toBe(true);
    expect(props.loop).toBe(true);
    expect(props.h_offset).toBe(0);
    expect(props.v_offset).toBe(0);
    expect(props.progress).toBeUndefined();
    expect(props.progress_ratio).toBeUndefined();
  });

  it('reads explicit follow controls', () => {
    const props = parsePathFollow2D(heading(), {
      progress_ratio: '0.25',
      h_offset: '4',
      v_offset: '-3',
      rotates: 'false',
      loop: 'false',
    });
    expect(props.progress_ratio).toBeCloseTo(0.25, 5);
    expect(props.h_offset).toBe(4);
    expect(props.v_offset).toBe(-3);
    expect(props.rotates).toBe(false);
    expect(props.loop).toBe(false);
  });

  it('keeps progress when only progress is set (edge)', () => {
    const props = parsePathFollow2D(heading(), { progress: '120' });
    expect(props.progress).toBe(120);
    expect(props.progress_ratio).toBeUndefined();
  });
});
