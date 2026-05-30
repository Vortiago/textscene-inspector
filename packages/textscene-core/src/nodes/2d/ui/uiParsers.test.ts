import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseColorRect, isColorRect } from './colorrect/parser';
import { parseLabel, isLabel } from './label/parser';
import { parseVBoxContainer, isVBoxContainer } from './vboxcontainer/parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseColorRect', () => {
  it('captures the fill color and base Control layout', () => {
    const p = parseColorRect(h({ name: 'Bg', type: 'ColorRect' }), {
      color: 'Color(0, 0, 1, 1)',
      anchors_preset: '15',
    });
    expect(p.color).toBe('Color(0, 0, 1, 1)');
    expect(p.anchorsPreset).toBe(15);
  });
  it('type guard', () => {
    expect(isColorRect(h({ type: 'ColorRect' }))).toBe(true);
    expect(isColorRect(h({ type: 'Label' }))).toBe(false);
  });
});

describe('parseLabel', () => {
  it('unquotes text and parses alignment + font-size override', () => {
    const p = parseLabel(h({ name: 'T', type: 'Label' }), {
      text: '"Hello World"',
      horizontal_alignment: '1',
      'theme_override_font_sizes/font_size': '18',
    });
    expect(p.text).toBe('Hello World');
    expect(p.horizontalAlignment).toBe(1);
    expect(p.themeOverrideFontSizes?.font_size).toBe(18);
  });
  it('type guard', () => {
    expect(isLabel(h({ type: 'Label' }))).toBe(true);
  });
});

describe('parseVBoxContainer', () => {
  it('parses base Control + separation constant', () => {
    const p = parseVBoxContainer(h({ name: 'M', type: 'VBoxContainer' }), {
      'theme_override_constants/separation': '8',
    });
    expect(p.themeOverrideConstants?.separation).toBe(8);
  });
  it('type guard', () => {
    expect(isVBoxContainer(h({ type: 'VBoxContainer' }))).toBe(true);
    expect(isVBoxContainer(h({ type: 'HBoxContainer' }))).toBe(false);
  });
});
