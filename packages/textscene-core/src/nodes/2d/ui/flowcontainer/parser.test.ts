import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseFlowContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseFlowContainer', () => {
  it('parses alignment, last_wrap_alignment, vertical and reverse_fill', () => {
    const p = parseFlowContainer(h({ name: 'F', type: 'FlowContainer' }), {
      alignment: '2',
      last_wrap_alignment: '3',
      vertical: 'true',
      reverse_fill: 'true',
    });
    expect(p.alignment).toBe(2);
    expect(p.lastWrapAlignment).toBe(3);
    expect(p.vertical).toBe(true);
    expect(p.reverseFill).toBe(true);
  });

  it('leaves every field undefined when absent, so the solver applies flow_container.h defaults', () => {
    const p = parseFlowContainer(h({ name: 'F', type: 'FlowContainer' }), {});
    expect(p.alignment).toBeUndefined();
    expect(p.lastWrapAlignment).toBeUndefined();
    expect(p.vertical).toBeUndefined();
    expect(p.reverseFill).toBeUndefined();
  });
});
