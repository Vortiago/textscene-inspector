import { describe, it, expect } from 'vitest';
import { canvasTextureSpecular, decodeCanvasTexture } from './decode';
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../../../godot/scene/canvasItem';

describe('decodeCanvasTexture', () => {
  it('reads the shading parameters and the sampler', () => {
    const texture = decodeCanvasTexture({
      specular_color: 'Color(0.5, 0.25, 1, 1)',
      specular_shininess: '0.5',
      texture_filter: '1',
      texture_repeat: '2',
    });
    expect(texture).toEqual({
      specularColor: { r: 0.5, g: 0.25, b: 1, a: 1 },
      specularShininess: 0.5,
      textureFilter: CanvasItemTextureFilter.NEAREST,
      textureRepeat: CanvasItemTextureRepeat.ENABLED,
    });
  });

  it("gives Godot's member defaults for a block that names nothing", () => {
    // `canvas_item.h:433-442`: white specular, shininess 1, both sampler slots inheriting.
    expect(decodeCanvasTexture({})).toEqual({
      specularColor: { r: 1, g: 1, b: 1, a: 1 },
      specularShininess: 1,
      textureFilter: CanvasItemTextureFilter.PARENT_NODE,
      textureRepeat: CanvasItemTextureRepeat.PARENT_NODE,
    });
  });

  it('keeps the default for a malformed value', () => {
    const texture = decodeCanvasTexture({
      specular_color: 'Color(oops)',
      specular_shininess: 'half',
      texture_filter: '42',
    });
    expect(texture.specularColor).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(texture.specularShininess).toBe(1);
    expect(texture.textureFilter).toBe(CanvasItemTextureFilter.PARENT_NODE);
  });
});

describe('canvasTextureSpecular', () => {
  it('is off at the default shininess, which the renderer tests below 0.999', () => {
    expect(canvasTextureSpecular(decodeCanvasTexture({}))).toBeNull();
    expect(canvasTextureSpecular(decodeCanvasTexture({ specular_shininess: '0.999' }))).toBeNull();
  });

  it('packs the colour and the shininess into the 8 bits a channel holds', () => {
    // `renderer_canvas_render_rd.cpp:3341-3346` packs `Color(specular.rgb, shininess)` as unorm8.
    const specular = canvasTextureSpecular(
      decodeCanvasTexture({ specular_color: 'Color(0.3, 1, 0, 1)', specular_shininess: '0.5' })
    );
    expect(specular).toEqual({ r: 76 / 255, g: 1, b: 0, a: 127 / 255 });
  });

  it('clamps a channel outside 0 to 1, as the pack does', () => {
    const specular = canvasTextureSpecular(
      decodeCanvasTexture({ specular_color: 'Color(2, -1, 0.5, 1)', specular_shininess: '-0.5' })
    );
    expect(specular).toEqual({ r: 1, g: 0, b: 127 / 255, a: 0 });
  });
});
