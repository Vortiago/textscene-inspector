import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseNinePatchRect } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseNinePatchRect', () => {
  it('keeps the raw texture ref, patch margins, region and axis-stretch modes', () => {
    const p = parseNinePatchRect(h({ name: 'Panel', type: 'NinePatchRect' }), {
      texture: 'ExtResource("1_tex")',
      patch_margin_left: '4',
      patch_margin_top: '5',
      patch_margin_right: '6',
      patch_margin_bottom: '7',
      region_rect: 'Rect2(1, 2, 30, 40)',
      draw_center: 'false',
      axis_stretch_horizontal: '1',
      axis_stretch_vertical: '2',
    });
    expect(p.texture).toBe('ExtResource("1_tex")');
    expect(p.patchMarginLeft).toBe(4);
    expect(p.patchMarginTop).toBe(5);
    expect(p.patchMarginRight).toBe(6);
    expect(p.patchMarginBottom).toBe(7);
    expect(p.regionRect).toEqual({ x: 1, y: 2, width: 30, height: 40 });
    expect(p.drawCenter).toBe(false);
    expect(p.axisStretchHorizontal).toBe(1);
    expect(p.axisStretchVertical).toBe(2);
  });

  it('inherits Control layout and leaves every own field undefined when absent', () => {
    const p = parseNinePatchRect(h({ name: 'Panel', type: 'NinePatchRect' }), {
      anchors_preset: '15',
      anchor_right: '1.0',
    });
    expect(p.name).toBe('Panel');
    expect(p.anchorsPreset).toBe(15);
    expect(p.texture).toBeUndefined();
    expect(p.patchMarginLeft).toBeUndefined();
    expect(p.regionRect).toBeUndefined();
    expect(p.drawCenter).toBeUndefined();
    expect(p.axisStretchHorizontal).toBeUndefined();
  });

  it('treats a malformed region_rect as unset rather than throwing', () => {
    const p = parseNinePatchRect(h({ name: 'Panel', type: 'NinePatchRect' }), {
      region_rect: 'not-a-rect',
    });
    expect(p.regionRect).toBeUndefined();
  });
});
