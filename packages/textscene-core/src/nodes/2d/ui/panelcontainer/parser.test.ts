import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parsePanelContainer, isPanelContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parsePanelContainer', () => {
  it('parses base Control layout and the panel style override', () => {
    const p = parsePanelContainer(h({ name: 'P', type: 'PanelContainer' }), {
      anchors_preset: '15',
      'theme_override_styles/panel': 'SubResource("StyleBoxFlat_1")',
    });
    expect(p.anchorsPreset).toBe(15);
    expect(p.themeOverrideStyles?.panel).toBe('SubResource("StyleBoxFlat_1")');
  });

  it('adds no fields beyond Control when none are set', () => {
    const p = parsePanelContainer(h({ name: 'Bare', type: 'PanelContainer' }), {});
    expect(p.name).toBe('Bare');
    expect(p.themeOverrideStyles).toBeUndefined();
  });

  it('type guard accepts PanelContainer and rejects others', () => {
    expect(isPanelContainer(h({ type: 'PanelContainer' }))).toBe(true);
    expect(isPanelContainer(h({ type: 'Panel' }))).toBe(false);
  });
});
