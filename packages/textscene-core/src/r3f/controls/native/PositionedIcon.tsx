/**
 * One icon quad at a Control-local rect. The Button painter, the overlays of its subclasses, the GraphEdit toolbar and the
 * ColorPicker share it, so an icon's origin, size and tint are placed in one spot.
 */
import type * as THREE from 'three';
import type { Rect2 } from '../../../godot/math/rect2';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { ControlQuad } from './controlQuad';

interface PositionedIconProps {
  /** The icon's rect in the parent's top-left coordinates. */
  rect: Rect2;
  texture: THREE.Texture | null;
  color: THREE.Color;
  opacity: number;
  renderOrder: number;
  /** The group's own canvas key, for an icon drawn at another canvas position (`CanvasItemGroup`). Omitted, it inherits the item's. */
  canvasKey?: number;
}

/** Draws nothing while `texture` is still loading. */
export function PositionedIcon({
  rect,
  texture,
  color,
  opacity,
  renderOrder,
  canvasKey,
}: PositionedIconProps) {
  if (!texture) return null;
  return (
    <CanvasItemGroup position={[rect.x, -rect.y, 0]} renderOrder={canvasKey}>
      <ControlQuad
        width={rect.w}
        height={rect.h}
        color={color}
        opacity={opacity}
        map={texture}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}
