/**
 * The canvas of a 3D sub-viewport: the tonemapped world as an opaque backdrop, and the viewport's
 * Controls drawn over it. Godot draws a viewport's canvas items after its 3D render, in the same
 * target (`renderer_viewport.cpp::_draw_viewport`), so the pass draws this scene into the target
 * last, through a frame whose bytes blend in sRGB numbers as the main canvas does.
 */
import * as THREE from 'three';

import { ControlQuad } from '../../../r3f/controls/native/controlQuad.js';
import type { TscnNode } from '../../../parser/types.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { ViewportControls } from './ViewportControls.js';
import { useInheritedRtl } from './useInheritedRtl.js';

const OPAQUE_WHITE = new THREE.Color(1, 1, 1);

interface ControlsOverWorldProps {
  path: string;
  nodes: readonly TscnNode[];
  size: Vector2;
  /** The tonemapped world the Controls draw over. */
  world: THREE.Texture;
}

export function ControlsOverWorld({ path, nodes, size, world }: ControlsOverWorldProps) {
  const inheritedRtl = useInheritedRtl(path);
  return (
    <>
      <ControlQuad
        width={size.x}
        height={size.y}
        color={OPAQUE_WHITE}
        opacity={1}
        map={world}
        renderOrder={-1}
      />
      <ViewportControls nodes={nodes} size={size} inheritedRtl={inheritedRtl} />
    </>
  );
}
