/**
 * The opaque tonemapped world under the 2D items and Controls of a 3D sub-viewport, which Godot draws
 * after its 3D render in the same target (`renderer_viewport.cpp::_draw_viewport`). The pass keeps the
 * backdrop on the view, as a Camera2D moves the canvas items and not the world (`renderer_viewport.cpp:46-86`).
 */
import type { RefObject } from 'react';
import * as THREE from 'three';

import { ControlQuad } from '../../../r3f/controls/native/controlQuad.js';
import { OVER_EVERY_LAYER } from '../../../r3f/canvasKeyWindow.js';
import { CanvasColorSpaceProvider, type CanvasColorSpace } from '../../../r3f/canvasColorSpace.js';
import type { Vector2 } from '../../../godot/math/vector.js';

const OPAQUE_WHITE = new THREE.Color(1, 1, 1);

interface CanvasOverWorldProps {
  size: Vector2;
  /** The tonemapped world the canvas draws over. */
  world: THREE.Texture;
  /** Written with the group that holds the backdrop, whose matrix the pass sets each frame. */
  anchor: RefObject<THREE.Group | null>;
  /** The space the canvas draws in, which the backdrop shares: it sits outside the viewport's canvas scope. */
  space: CanvasColorSpace;
}

export function CanvasOverWorld({ size, world, anchor, space }: CanvasOverWorldProps) {
  return (
    <group ref={anchor} matrixAutoUpdate={false} userData={{ [OVER_EVERY_LAYER]: true }}>
      <CanvasColorSpaceProvider value={space}>
        <ControlQuad
          width={size.x}
          height={size.y}
          color={OPAQUE_WHITE}
          opacity={1}
          map={world}
          renderOrder={-1}
          replacesBackdrop
        />
      </CanvasColorSpaceProvider>
    </group>
  );
}
