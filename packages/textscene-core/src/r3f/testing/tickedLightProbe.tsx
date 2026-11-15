/**
 * A light texture quad that a default-priority frame callback moves on every frame, as an
 * AnimationPlayer moves a light. Its shadow pose shows whether its canvas samples the shadow inputs
 * after the tick, as Godot does, or a frame behind it. Test-only.
 */
import { useRef, useState } from 'react';
import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useShadowLightPose } from '../lighting2d/shadowMap/shadowLightPose';

/** How far the tick moves the light on each frame, in previewer world units. */
export const TICK_STEP = 10;

/** The left edge of the quad's 2×2 rect at the origin. */
export const UNMOVED_LEFT = -1;

/** The left edge of the shadow pose the probe last rendered, or null with no pose. */
export interface PoseReading {
  left: number | null;
}

export function TickedLightProbe({ reading }: { reading: PoseReading }) {
  const light = useRef<THREE.Group>(null);
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  reading.left = useShadowLightPose(quad, true)?.rect.minX ?? null;
  useFrame(() => {
    light.current!.position.x += TICK_STEP;
  });
  return (
    <group ref={light}>
      <mesh ref={setQuad}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </group>
  );
}
