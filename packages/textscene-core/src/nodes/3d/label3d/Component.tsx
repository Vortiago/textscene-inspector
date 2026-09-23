/**
 * <Label3D>: glyph text on a billboard-able group, shaped by the engine the 2D
 * Control Label uses (`r3f/controls/native/text/`). `LabelGlyphs` is `React.lazy`,
 * so the shaping engine and font stay out of the initial bundle. `pixel_size` is a
 * nested group scale, since the glyph geometry is in Godot px.
 */

import { Suspense, lazy, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Label3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { useFixedSize } from '../../../r3f/hooks/useFixedSize';

// This file imports nothing from the shaping engine, so the engine stays out of the
// static closure `r3f/nodes/index.ts` pulls eagerly.
const LabelGlyphs = lazy(() => import('./LabelGlyphs'));

/**
 * Marks the invisible bounds proxy, like `CsgPrimitive.tsx`'s `CSG_BOUNDS_PROXY`.
 * `frameSceneBounds.ts` unions mesh AABBs, and the lazy glyphs can land after
 * `CameraFit`'s last retry, so without a synchronous stand-in the fit ignores the label.
 */
export const LABEL3D_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

export function Label3D({ node, children }: NodeComponentProps) {
  const { showLabels } = useViewportMode();
  const properties = node.properties as Label3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const groupRef = useRef<THREE.Group | null>(null);

  // Shared with Sprite3D, so both implement Godot's billboard modes identically.
  useBillboard(groupRef, properties.billboard);

  // `label_3d.cpp:396` hands the flag to the same cached shader the billboard
  // mode does; both are per-frame effects on the label's own group.
  useFixedSize(groupRef, properties.fixed_size, scale);

  // On by default to match Godot (the ADR-0008 amendment). The Labels toggle
  // hides it, and a marker group still positions any children and stays selectable.
  if (!showLabels) {
    return (
      <group name={node.name} position={position} rotation={rotation} scale={scale}>
        {children}
      </group>
    );
  }

  return (
    <>
      <group
        ref={groupRef}
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        userData={{ billboardMode: properties.billboard, isLabel3D: true }}
      >
        <group scale={properties.pixel_size}>
          <Suspense fallback={null}>
            <LabelGlyphs properties={properties} />
          </Suspense>
        </group>
        {/* A point, not a text-sized box: Godot's `_place_camera` runs before Label3D
            shapes text. Its `_scene_bounds()` measured size [3.0, 4.0, 3.0] then and
            [4.938, 7.445, 4.938] after `_settle()` (the `label_3d.cpp:625-638` cube),
            and only the first camera reproduces `--frame`. Rotation cannot move a point. */}
        <mesh visible={false} userData={LABEL3D_BOUNDS_PROXY}>
          <boxGeometry args={[0, 0, 0]} />
        </mesh>
      </group>
      {/* Descendants sit in a sibling group with the same transform: `billboard`
          rewrites the label group's quaternion every frame, and in Godot it is a
          shader effect that never spins the node's children. */}
      {children === undefined ? null : (
        <group position={position} rotation={rotation} scale={scale}>
          {children}
        </group>
      )}
    </>
  );
}
