import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseAspectRatioContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseAspectRatioContainer', () => {
  it('parses ratio, stretch_mode and both alignments', () => {
    const p = parseAspectRatioContainer(h({ name: 'A', type: 'AspectRatioContainer' }), {
      ratio: '1.777',
      stretch_mode: '3',
      alignment_horizontal: '0',
      alignment_vertical: '2',
    });
    expect(p.ratio).toBe(1.777);
    expect(p.stretchMode).toBe(3);
    expect(p.alignmentHorizontal).toBe(0);
    expect(p.alignmentVertical).toBe(2);
  });

  it('leaves every field undefined when absent, so the solver applies aspect_ratio_container.h defaults', () => {
    const p = parseAspectRatioContainer(h({ name: 'A', type: 'AspectRatioContainer' }), {});
    expect(p.ratio).toBeUndefined();
    expect(p.stretchMode).toBeUndefined();
    expect(p.alignmentHorizontal).toBeUndefined();
    expect(p.alignmentVertical).toBeUndefined();
  });
});
