/**
 * The one surface of a 2D sprite, Sprite2D or AnimatedSprite2D: a quad of the frame's size at the
 * sprite's offset, mirrored by mesh scale for `flip_h` and `flip_v`.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vector2 } from '../../godot/math/vector';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import type { CanvasSurface } from './canvasSurface';

/** The properties both 2D sprites place their quad with. */
export interface SpritePlacement {
  offset: Vector2;
  centered: boolean;
  flip_h: boolean;
  flip_v: boolean;
}

export function useSpriteQuad(
  { offset, centered, flip_h, flip_v }: SpritePlacement,
  { width, height }: { width: number; height: number }
): readonly CanvasSurface[] {
  const geometry = useMemo(() => new THREE.PlaneGeometry(width, height), [width, height]);
  useDisposeOnRelease(geometry);
  return useMemo(() => {
    // Quad centre in Godot 2D space (+Y down), then Y-negated. Centred, it sits at
    // `offset`. Otherwise the top-left does, so the centre is offset + (w/2, h/2).
    const cgx = offset.x + (centered ? 0 : width / 2);
    const cgy = offset.y + (centered ? 0 : height / 2);
    return [{ geometry, position: [cgx, -cgy, 0], scale: [flip_h ? -1 : 1, flip_v ? -1 : 1, 1] }];
  }, [geometry, width, height, offset.x, offset.y, centered, flip_h, flip_v]);
}
