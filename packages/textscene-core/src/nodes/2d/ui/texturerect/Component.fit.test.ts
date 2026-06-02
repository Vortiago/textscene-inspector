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
import { textureRectFit } from './Component';

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
