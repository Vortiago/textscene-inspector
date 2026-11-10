/**
 * `<TextureQuad>`: a texture stretched over a rect in its Control's top-left space, the quad that
 * `draw_texture_rect` makes for an icon. It draws nothing until the texture has loaded.
 */
import type { ComponentProps } from 'react';
import type * as THREE from 'three';
import type { Rect2 } from '../../../godot/math/rect2';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { ControlQuad } from './controlQuad';

interface TextureQuadProps {
  rect: Rect2;
  texture: THREE.Texture | null;
  /** Linear colour multiplier. */
  color: ComponentProps<typeof ControlQuad>['color'];
  opacity: number;
  renderOrder: number;
}

/** @canonical Draw an icon texture over a rect of a Control. Draws nothing until the texture has loaded. */
export function TextureQuad({ rect, texture, color, opacity, renderOrder }: TextureQuadProps) {
  if (!texture) return null;
  return (
    <CanvasItemGroup position={[rect.x, -rect.y, 0]} renderOrder={renderOrder}>
      <ControlQuad
        renderOrder={renderOrder}
        width={rect.w}
        height={rect.h}
        color={color}
        opacity={opacity}
        map={texture}
      />
    </CanvasItemGroup>
  );
}
