import { describe, expect, it } from 'vitest';
import { parseCenterContainer, isCenterContainer } from './parser';
import type { ParsedHeading } from '../../../../parser/utils';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCenterContainer', () => {
  it('delegates to the base Control parser', () => {
    const p = parseCenterContainer(heading({ name: 'Center', type: 'CenterContainer' }), {
      anchors_preset: '15',
    });
    expect(p.anchorsPreset).toBe(15);
  });

  it('adds no fields beyond Control (size flags still collected)', () => {
    const p = parseCenterContainer(heading({ name: 'Center', type: 'CenterContainer' }), {
      size_flags_horizontal: '3',
    });
    expect(p.sizeFlagsHorizontal).toBe(3);
  });
});

describe('isCenterContainer', () => {
  it('matches CenterContainer', () => {
    expect(isCenterContainer(heading({ type: 'CenterContainer' }))).toBe(true);
  });
  it('rejects other types', () => {
    expect(isCenterContainer(heading({ type: 'VBoxContainer' }))).toBe(false);
  });
});
