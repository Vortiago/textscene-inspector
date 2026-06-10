/**
 * `textureRectFit` maps a TextureRect's Godot stretch/expand modes to the CSS
 * that draws its texture WITHOUT letting the image's intrinsic size drive the
 * layout. The bug it guards: a tall portrait (DialogSystem LeftPortrait,
 * expand_mode=5, no stretch_mode) floored the flex chain at its natural height
 * and spilled past the dialog box / canvas. The <img> is taken out of flow
 * (absolute, inset 0) inside its layout-sized wrapper, so the wrapper's flex
 * size — not the texture's intrinsic size — wins, and the image fits.
 */
import { describe, it, expect } from 'vitest';
import { textureRectFit, textureRectTileStyle } from './Component';

describe('textureRectFit', () => {
  it('takes the image out of flow and fits it to its box', () => {
    // The DialogSystem portrait: expand_mode 5, no stretch_mode.
    const s = textureRectFit({ expandMode: 5 });
    // Out of flow → the texture's intrinsic size can't floor the flex layout.
    expect(s.position).toBe('absolute');
    expect(s.inset).toBe(0);
    expect(s.width).toBe('100%');
    expect(s.height).toBe('100%');
    // Fit + keep aspect — was `object-fit: none` (intrinsic size → overflow).
    expect(s.objectFit).toBe('contain');
  });

  it('maps explicit stretch modes (0 fill, 6 cover) and centers 3/5', () => {
    expect(textureRectFit({ stretchMode: 0 }).objectFit).toBe('fill');
    expect(textureRectFit({ stretchMode: 6 }).objectFit).toBe('cover');
    expect(textureRectFit({ stretchMode: 5 }).objectPosition).toBe('center');
  });
});

describe('textureRectFit parity (Godot stretch modes)', () => {
  it('KEEP (2) draws at intrinsic size, top-left (#23)', () => {
    const s = textureRectFit({ stretchMode: 2 });
    expect(s.objectFit).toBe('none');
    expect(s.objectPosition).toBe('top left');
  });

  it('KEEP_CENTERED (3) draws at intrinsic size, centered (#24)', () => {
    const s = textureRectFit({ stretchMode: 3 });
    expect(s.objectFit).toBe('none');
    expect(s.objectPosition).toBe('center');
  });

  it('KEEP_ASPECT (4) fits + keeps aspect, anchored top-left (#46)', () => {
    const s = textureRectFit({ stretchMode: 4 });
    expect(s.objectFit).toBe('contain');
    expect(s.objectPosition).toBe('top left');
  });

  it('flip_h / flip_v map to a CSS scale transform (#25, #26)', () => {
    expect(textureRectFit({ flipH: true }).transform).toBe('scale(-1, 1)');
    expect(textureRectFit({ flipV: true }).transform).toBe('scale(1, -1)');
    expect(textureRectFit({ flipH: true, flipV: true }).transform).toBe('scale(-1, -1)');
    expect(textureRectFit({}).transform).toBeUndefined();
  });
});

describe('textureRectTileStyle (STRETCH_TILE)', () => {
  it('tiles the texture via background-repeat at natural size (#22)', () => {
    const s = textureRectTileStyle('data:image/png;base64,XYZ', { stretchMode: 1 });
    expect(s.backgroundImage).toBe('url(data:image/png;base64,XYZ)');
    expect(s.backgroundRepeat).toBe('repeat');
    expect(s.backgroundSize).toBe('auto');
    expect(s.position).toBe('absolute');
  });

  it('applies flip transform to the tiled layer too', () => {
    expect(textureRectTileStyle('data:x', { stretchMode: 1, flipH: true }).transform).toBe('scale(-1, 1)');
  });
});
