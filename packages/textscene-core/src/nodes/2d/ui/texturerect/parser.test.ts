import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseTextureRect } from './parser';
import { TscnParser } from '../../../../parser/TscnParser';

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

describe('the Godot-3 expand flags', () => {
  // texture_rect.cpp:171-173: `(expand || ignore_texture_size) && bool(p_value)`
  // writes EXPAND_IGNORE_SIZE; a falsy value is dropped. Measured on 4.6.3.
  it('expand = true parses as expandMode 1', () => {
    const scene = new TscnParser().parse('[gd_scene format=3]\n\n[node name="T" type="TextureRect"]\nexpand = true\n');
    expect((scene.nodes[0]!.properties as { expandMode?: number }).expandMode).toBe(1);
  });

  it('ignore_texture_size = false leaves an authored expand_mode alone', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="T" type="TextureRect"]\nexpand_mode = 3\nignore_texture_size = false\n'
    );
    expect((scene.nodes[0]!.properties as { expandMode?: number }).expandMode).toBe(3);
  });
});
