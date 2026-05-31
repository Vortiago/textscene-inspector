import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseGridContainer, isGridContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseGridContainer', () => {
  it('parses columns + separation constants from base Control', () => {
    const p = parseGridContainer(h({ name: 'G', type: 'GridContainer' }), {
      columns: '3',
      'theme_override_constants/h_separation': '8',
      'theme_override_constants/v_separation': '12',
    });
    expect(p.columns).toBe(3);
    expect(p.themeOverrideConstants?.h_separation).toBe(8);
    expect(p.themeOverrideConstants?.v_separation).toBe(12);
  });

  it('leaves columns undefined when absent', () => {
    const p = parseGridContainer(h({ name: 'G', type: 'GridContainer' }), {});
    expect(p.columns).toBeUndefined();
  });

  it('type guard accepts/rejects', () => {
    expect(isGridContainer(h({ type: 'GridContainer' }))).toBe(true);
    expect(isGridContainer(h({ type: 'VBoxContainer' }))).toBe(false);
  });
});
