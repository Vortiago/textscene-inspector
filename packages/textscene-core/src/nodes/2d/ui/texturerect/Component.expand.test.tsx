/**
 * TextureRect's `expand_mode` gives the control a minimum size.
 *
 * The property was parsed and typed but read by nothing, and the `<img>` is
 * absolutely positioned (deliberately — an intrinsically-sized image floors the
 * flex layout and a tall portrait overflows its box). The two together mean a
 * container-child TextureRect contributed ZERO minimum size, while Godot's
 * default `EXPAND_KEEP_SIZE` makes the control at least the texture's size — so
 * a logo inside a CenterContainer collapsed to nothing
 * (scenes/demos/3d/voxel/menu/main/main_menu.tscn `TitleScreen/Logo/Logo`).
 *
 * `texture_rect.cpp::get_minimum_size()`:
 *   KEEP_SIZE (0)               → the texture's size
 *   IGNORE_SIZE (1)             → none
 *   FIT_WIDTH (2)               → Size2(get_size().y, 0)
 *   FIT_WIDTH_PROPORTIONAL (3)  → Size2(get_size().y * aspect, 0)
 *   FIT_HEIGHT (4)              → Size2(0, get_size().x)
 *   FIT_HEIGHT_PROPORTIONAL (5) → Size2(0, get_size().x / aspect)
 *
 * The four FIT_* modes derive a minimum from the control's CURRENT size — a
 * self-referential rule with no direct CSS equivalent, but `aspect-ratio` says
 * the same thing from the other direction: FIT_WIDTH/FIT_HEIGHT tie one axis to
 * the other 1:1 (Godot ignores the texture's own aspect for those), and the
 * PROPORTIONAL pair ties them at the texture's aspect.
 */
import { describe, expect, it } from 'vitest';
import { textureRectMinSize } from './Component';

const TEXTURE = { width: 320, height: 160 };

describe('textureRectMinSize', () => {
  it('is the texture size for EXPAND_KEEP_SIZE — the Godot default', () => {
    expect(textureRectMinSize(undefined, TEXTURE)).toEqual({ minWidth: 320, minHeight: 160 });
    expect(textureRectMinSize(0, TEXTURE)).toEqual({ minWidth: 320, minHeight: 160 });
  });

  it('is nothing for EXPAND_IGNORE_SIZE', () => {
    expect(textureRectMinSize(1, TEXTURE)).toEqual({});
  });

  it('pins the texture aspect for the PROPORTIONAL fit modes', () => {
    expect(textureRectMinSize(3, TEXTURE)).toEqual({ aspectRatio: '320 / 160' });
    expect(textureRectMinSize(5, TEXTURE)).toEqual({ aspectRatio: '320 / 160' });
  });

  it('squares the box for the non-proportional fit modes', () => {
    // "The height of the texture will be ignored. Minimum width will be equal
    // to the current height." — the two axes are tied 1:1, texture aspect
    // deliberately discarded.
    expect(textureRectMinSize(2, TEXTURE)).toEqual({ aspectRatio: '1 / 1' });
    expect(textureRectMinSize(4, TEXTURE)).toEqual({ aspectRatio: '1 / 1' });
  });

  it('contributes nothing when the texture has not loaded', () => {
    expect(textureRectMinSize(0, undefined)).toEqual({});
    expect(textureRectMinSize(3, undefined)).toEqual({});
  });
});
