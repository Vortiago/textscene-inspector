/**
 * `<AlphaCheckerboardQuad>`: the tiled `mini_checkerboard.svg` backdrop under a translucent
 * ColorPicker swatch (`draw_texture_rect(theme_cache.background_icon, r, true)`, `p_tile` true), drawn
 * at local (0, 0). It tiles as `texturerect/Component.tsx`'s `STRETCH_TILE` does, with a `1 - repeat.y`
 * V offset: three's V axis runs bottom-up, and Godot tiles from the top-left.
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
   * This node's themed background icon. The item name differs per caller (`"bg"` for
   * ColorPickerButton, `"sample_bg"` for ColorPicker, `"preset_bg"` for ColorPresetButton), so the
   * call site reads it from `SolveNode.icons`.
   */
  themed?: ThemedIconRef;
}

export function AlphaCheckerboardQuad({ width, height, color, opacity, renderOrder, themed }: AlphaCheckerboardQuadProps) {
  // `useNodeIcon` clones a themed ref or loads the vendored fallback per input, so this instance
  // is ours to mutate without a `.clone()`.
  const texture = useNodeIcon(themed, MINI_CHECKERBOARD_ICON);

  const tiled = useMemo(() => {
    if (!texture) return null;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    // A themed icon's own size sets the repeat. The vendored size stands in while it loads (no
    // `.image` yet) or when nothing themed it.
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
