/**
 * `<AlphaCheckerboardQuad>` — the tiled `mini_checkerboard.svg` backdrop
 * `ColorPickerButton`/`ColorPicker` draw under a translucent colour swatch
 * (`draw_texture_rect(theme_cache.background_icon, r, true)` — the `true` is
 * `p_tile`). Drawn at (0, 0) in its own local space; wrap the caller's
 * `<CanvasItemGroup>` around it to place the swatch rect.
 *
 * Tiling matches `nodes/2d/ui/texturerect/Component.tsx`'s `STRETCH_TILE`
 * branch: `RepeatWrapping`, `repeat = size / textureSize`, and a `1 - repeat.y`
 * V offset so the pattern anchors at the rect's TOP edge (three's V axis runs
 * bottom-up; Godot tiles from the top-left).
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { MINI_CHECKERBOARD_ICON, MINI_CHECKERBOARD_SIZE } from '../../../../r3f/controls/native/themeIcons';

export interface AlphaCheckerboardQuadProps {
  width: number;
  height: number;
  color: THREE.Color;
  opacity: number;
  renderOrder: number;
}

export function AlphaCheckerboardQuad({ width, height, color, opacity, renderOrder }: AlphaCheckerboardQuadProps) {
  // `useIconTexture` allocates a FRESH texture per call site (its own
  // `useMemo`, keyed on the URL alone), so this instance is already
  // exclusively ours to mutate — no `.clone()` needed before setting tiling.
  const texture = useIconTexture(MINI_CHECKERBOARD_ICON);

  const tiled = useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    const repeat = { x: width / MINI_CHECKERBOARD_SIZE, y: height / MINI_CHECKERBOARD_SIZE };
    texture.repeat.set(repeat.x, repeat.y);
    texture.offset.set(0, 1 - repeat.y);
    texture.needsUpdate = true;
    return texture;
  }, [texture, width, height]);

  useEffect(() => () => tiled.dispose(), [tiled]);

  if (width <= 0 || height <= 0) return null;

  return <ControlQuad width={width} height={height} color={color} opacity={opacity} map={tiled} renderOrder={renderOrder} />;
}
