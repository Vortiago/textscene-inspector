import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parsePanel } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parsePanel', () => {
  it('inherits Control layout fields', () => {
    const p = parsePanel(h({ name: 'Bg', type: 'Panel' }), {
      anchors_preset: '15',
      anchor_right: '1.0',
      anchor_bottom: '1.0',
    });
    expect(p.name).toBe('Bg');
    expect(p.anchorsPreset).toBe(15);
    expect(p.anchorRight).toBe(1);
    expect(p.anchorBottom).toBe(1);
  });

  it('collects the panel StyleBox override', () => {
    const p = parsePanel(h({ name: 'Bg', type: 'Panel' }), {
      'theme_override_styles/panel': 'SubResource("StyleBoxFlat_1")',
    });
    expect(p.themeOverrideStyles?.panel).toBe('SubResource("StyleBoxFlat_1")');
  });
});
