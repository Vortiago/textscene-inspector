/**
 * The opaque tonemapped world under the 2D items and Controls of a 3D sub-viewport, which Godot draws
 * after its 3D render in the same target (`renderer_viewport.cpp::_draw_viewport`). The pass keeps the
 * backdrop on the view, as a Camera2D moves the canvas items and not the world (`renderer_viewport.cpp:46-86`).
 */
import type { RefObject } from 'react';
import * as THREE from 'three';

import { ControlQuad } from '../controls/native/controlQuad.js';
import { OVER_EVERY_LAYER } from '../canvasKeyWindow.js';
import type { Vector2 } from '../../godot/math/vector.js';

const OPAQUE_WHITE = new THREE.Color(1, 1, 1);

interface CanvasOverWorldProps {
  size: Vector2;
  /** The tonemapped world the canvas draws over. */
  world: THREE.Texture;
  /** Written with the group that holds the backdrop, whose matrix the pass sets each frame. */
  anchor: RefObject<THREE.Group | null>;
}

export function CanvasOverWorld({ size, world, anchor }: CanvasOverWorldProps) {
  // paint-order-safe: the anchor holds one quad, which carries its own renderOrder.
  return (
    <group ref={anchor} matrixAutoUpdate={false} userData={{ [OVER_EVERY_LAYER]: true }}>
      <ControlQuad
        width={size.x}
        height={size.y}
        color={OPAQUE_WHITE}
        opacity={1}
        map={world}
        renderOrder={-1}
        replacesBackdrop
      />
    </group>
  );
}
