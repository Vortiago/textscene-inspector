import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseTextureRect } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseTextureRect', () => {
  it('keeps raw texture ref + parses expand/stretch modes', () => {
    const p = parseTextureRect(h({ name: 'Icon', type: 'TextureRect' }), {
      texture: 'ExtResource("1_tex")',
      expand_mode: '1',
      stretch_mode: '5',
    });
    expect(p.texture).toBe('ExtResource("1_tex")');
    expect(p.expandMode).toBe(1);
    expect(p.stretchMode).toBe(5);
  });

  it('inherits Control layout + leaves modes undefined when absent', () => {
    const p = parseTextureRect(h({ name: 'Icon', type: 'TextureRect' }), {
      anchors_preset: '15',
      anchor_right: '1.0',
    });
    expect(p.name).toBe('Icon');
    expect(p.anchorsPreset).toBe(15);
    expect(p.texture).toBeUndefined();
    expect(p.expandMode).toBeUndefined();
    expect(p.stretchMode).toBeUndefined();
    expect(p.flipH).toBeUndefined();
    expect(p.flipV).toBeUndefined();
  });

  it('parses flip_h / flip_v (#25, #26)', () => {
    const p = parseTextureRect(h({ name: 'Icon', type: 'TextureRect' }), {
      flip_h: 'true',
      flip_v: 'true',
    });
    expect(p.flipH).toBe(true);
    expect(p.flipV).toBe(true);
  });
});
