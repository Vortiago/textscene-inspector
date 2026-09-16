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
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import type { ThemedIconRef } from '../../../../r3f/controls/native/solveTree';
import { MINI_CHECKERBOARD_ICON, MINI_CHECKERBOARD_SIZE } from '../../../../r3f/controls/native/themeIcons';

export interface AlphaCheckerboardQuadProps {
  width: number;
  height: number;
  color: THREE.Color;
  opacity: number;
  renderOrder: number;
  /**
   * This node's OWN themed answer for its background icon — the theme item
   * NAME differs per caller (`"bg"` for ColorPickerButton, `"sample_bg"` for
   * ColorPicker, `"preset_bg"` for ColorPresetButton), so the key is read
   * from `SolveNode.icons` at the CALL SITE, never here.
   */
  themed?: ThemedIconRef;
}

export function AlphaCheckerboardQuad({ width, height, color, opacity, renderOrder, themed }: AlphaCheckerboardQuadProps) {
  // `useNodeIcon` clones (a themed ref) or freshly loads (the vendored
  // fallback) on every distinct input, so this instance is already
  // exclusively ours to mutate — no further `.clone()` needed before tiling.
  const texture = useNodeIcon(themed, MINI_CHECKERBOARD_ICON);

  const tiled = useMemo(() => {
    if (!texture) return null;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    // A themed background icon need not share the vendored tile's own size —
    // its OWN pixel dimensions set the tiling repeat, falling back to the
    // vendored constant only while a themed texture is still loading (no
    // `.image` yet) or when nothing themed it at all.
    const tileSize = {
      x: (texture.image as { width?: number } | undefined)?.width || MINI_CHECKERBOARD_SIZE,
      y: (texture.image as { height?: number } | undefined)?.height || MINI_CHECKERBOARD_SIZE,
    };
    const repeat = { x: width / tileSize.x, y: height / tileSize.y };
    texture.repeat.set(repeat.x, repeat.y);
    texture.offset.set(0, 1 - repeat.y);
    texture.needsUpdate = true;
    return texture;
  }, [texture, width, height]);

  useEffect(() => (tiled ? () => tiled.dispose() : undefined), [tiled]);

  if (width <= 0 || height <= 0 || !tiled) return null;

  return <ControlQuad width={width} height={height} color={color} opacity={opacity} map={tiled} renderOrder={renderOrder} />;
}
