/**
 * `S`'s starting value, written by a full-screen quad rather than by a clear
 * colour — so the seed passes through no colour-management path on its way into
 * a `NoColorSpace` target, and the renderer's global clear state is never
 * touched. Which value it writes is the pass's business (`CanvasLighting2D.tsx`
 * swaps the uniform per pass); this module is only the quad.
 */

import { useCallback } from 'react';
import * as THREE from 'three';
import { LIGHT_SEED_LAYER, SEED_RENDER_ORDER } from './lightPassLayers.js';

const SEED_VERTEX = /* glsl */ `
void main() {
  // A full-NDC quad from a unit plane: the accumulator is screen-space, so the
  // seed has to cover the whole target wherever the canvas camera is panned.
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const SEED_FRAGMENT = /* glsl */ `
uniform vec3 uSeed;
void main() {
  // rgb: where Godot's base pass leaves the item, with the albedo divided out.
  // alpha: no light has been counted yet.
  gl_FragColor = vec4(uSeed, 0.0);
}
`;

export function createSeedMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SEED_VERTEX,
    fragmentShader: SEED_FRAGMENT,
    uniforms: { uSeed: { value: new THREE.Vector3(1, 1, 1) } },
    // NoBlending, so the quad overwrites rather than accumulates — this IS the
    // clear. `transparent` puts it in the same sorted list as the light quads,
    // which is what lets `renderOrder` place it beneath them.
    blending: THREE.NoBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

/** Writes `S`'s starting value over the whole accumulator, under every light. */
export function LightAccumulatorSeed({ material }: { material: THREE.ShaderMaterial }) {
  const toSeedLayer = useCallback((mesh: THREE.Mesh | null) => {
    mesh?.layers.set(LIGHT_SEED_LAYER);
  }, []);

  return (
    <mesh
      ref={toSeedLayer}
      material={material}
      renderOrder={SEED_RENDER_ORDER}
      // The quad ignores every matrix, so its bounds say nothing about where it
      // lands; culling it against the panned camera would drop the seed.
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
