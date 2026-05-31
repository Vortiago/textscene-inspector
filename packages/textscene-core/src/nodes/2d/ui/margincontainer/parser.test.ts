import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseMarginContainer, isMarginContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseMarginContainer', () => {
  it('parses base Control + margin constants', () => {
    const p = parseMarginContainer(h({ name: 'M', type: 'MarginContainer' }), {
      'theme_override_constants/margin_left': '16',
      'theme_override_constants/margin_top': '8',
      anchors_preset: '15',
    });
    expect(p.themeOverrideConstants?.margin_left).toBe(16);
    expect(p.themeOverrideConstants?.margin_top).toBe(8);
    expect(p.anchorsPreset).toBe(15);
  });

  it('adds no fields beyond Control when only base properties are present', () => {
    const p = parseMarginContainer(h({ name: 'M', type: 'MarginContainer' }), {});
    expect(p.name).toBe('M');
    expect(p.themeOverrideConstants).toBeUndefined();
  });

  it('type guard accepts/rejects', () => {
    expect(isMarginContainer(h({ type: 'MarginContainer' }))).toBe(true);
    expect(isMarginContainer(h({ type: 'VBoxContainer' }))).toBe(false);
  });
});
