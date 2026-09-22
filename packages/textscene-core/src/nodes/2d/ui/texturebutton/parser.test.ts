import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseTextureButton } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseTextureButton', () => {
  it('reads all five texture slots as raw, unresolved refs', () => {
    const p = parseTextureButton(h({ name: 'TB', type: 'TextureButton' }), {
      texture_normal: 'SubResource("A")',
      texture_pressed: 'SubResource("B")',
      texture_hover: 'SubResource("C")',
      texture_disabled: 'SubResource("D")',
      texture_focused: 'SubResource("E")',
    });
    expect(p.textureNormal).toBe('SubResource("A")');
    expect(p.texturePressed).toBe('SubResource("B")');
    expect(p.textureHover).toBe('SubResource("C")');
    expect(p.textureDisabled).toBe('SubResource("D")');
    expect(p.textureFocused).toBe('SubResource("E")');
  });

  it('reads ignore_texture_size, stretch_mode, flip_h/flip_v and the inherited BaseButton flags', () => {
    const p = parseTextureButton(h({ name: 'TB', type: 'TextureButton' }), {
      ignore_texture_size: 'true',
      stretch_mode: '4',
      flip_h: 'true',
      flip_v: 'true',
      disabled: 'true',
      button_pressed: 'true',
    });
    expect(p.ignoreTextureSize).toBe(true);
    expect(p.stretchMode).toBe(4);
    expect(p.flipH).toBe(true);
    expect(p.flipV).toBe(true);
    expect(p.disabled).toBe(true);
    expect(p.buttonPressed).toBe(true);
  });

  it('leaves every texture slot undefined and every boolean false, stretch_mode undefined, when absent', () => {
    const p = parseTextureButton(h({ name: 'TB', type: 'TextureButton' }), {});
    expect(p.textureNormal).toBeUndefined();
    expect(p.texturePressed).toBeUndefined();
    expect(p.textureHover).toBeUndefined();
    expect(p.textureDisabled).toBeUndefined();
    expect(p.textureFocused).toBeUndefined();
    expect(p.ignoreTextureSize).toBe(false);
    expect(p.stretchMode).toBeUndefined();
    expect(p.flipH).toBe(false);
    expect(p.flipV).toBe(false);
    expect(p.disabled).toBe(false);
    expect(p.buttonPressed).toBe(false);
  });
});
