/**
 * <ShadowVolumeMask> — the stencil half of a shadowed 2D light.
 *
 * Draws one light's extruded shadow volumes with colour writes off, stamping a
 * stencil value over everything that light cannot see. The light's own cookie
 * quad then draws with `litQuadStencilProps(ordinal)`, which rejects exactly
 * those pixels. Both sides take their ref and render order from the helpers
 * here, because the two MUST agree and a hand-written pair silently rots.
 *
 * WHY A PER-LIGHT REF AND NOT A CLEAR. Lights accumulate into one target in a
 * single pass, so a shared ref of 1 leaks: light N's cookie would reject every
 * pixel any earlier light had shadowed, and the scene reads "shadows too dark"
 * rather than "stencil bug". Giving each light its own ref makes an earlier
 * light's leftover stamp simply unequal, so it costs one stencil clear per PASS
 * instead of one per light, and no restore pass at all.
 *
 * WHY `transparent`. An additive cookie quad sorts into three's transparent
 * group. A colour-write-off mask reads as opaque unless told otherwise, and
 * three draws the whole opaque group first — every light's volumes before any
 * light's cookie, which scrambles the stamps no matter how the refs are
 * assigned. Both meshes must sit in the same group for `renderOrder` to
 * interleave them, and three's transparent sort compares `renderOrder` ahead of
 * z, so the 2n / 2n+1 pairing holds.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildShadowVolumes, type ShadowCasterEdges, type ShadowLight } from './shadowVolumes';

/**
 * Distinct stencil values available to one pass. The buffer is 8-bit and 0 is
 * the cleared state, so refs run 1..255 and wrap — exact for any pass with at
 * most this many shadowed lights, and a pass with more needs a stencil clear
 * every 255 lights to stay exact.
 */
export const SHADOW_STENCIL_REFS = 255;

/** The stencil value light `ordinal` stamps. Distinct per light within a pass. */
export function shadowStencilRef(ordinal: number): number {
  const n = Math.abs(Math.trunc(ordinal)) % SHADOW_STENCIL_REFS;
  return n + 1;
}

/** Render order for light `ordinal`'s volumes — immediately before its quad. */
export function shadowVolumeRenderOrder(ordinal: number): number {
  return ordinal * 2;
}

/** Render order for light `ordinal`'s cookie quad — immediately after its volumes. */
export function litQuadRenderOrder(ordinal: number): number {
  return ordinal * 2 + 1;
}

/**
 * Spread onto the light's cookie-quad material so it skips its own shadow.
 * Reads the stencil without touching it: the stamp stays until the next pass
 * clear, which is harmless because no other light tests this ref.
 */
export function litQuadStencilProps(ordinal: number) {
  return {
    stencilWrite: true,
    stencilRef: shadowStencilRef(ordinal),
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  } as const;
}

export interface ShadowVolumeMaskProps {
  /** Shadow origin and the rect the light reaches, in the previewer's 2D world space. */
  light: ShadowLight;
  /** This light's casters — `worldShadowCasters` filtered by `shadow_item_cull_mask`. */
  casters: readonly ShadowCasterEdges[];
  /**
   * This light's index within the pass. Only distinctness matters, not order or
   * density; two lights sharing an ordinal shadow each other.
   */
  ordinal: number;
  /** The layer the light's cookie quad draws on — the mask must share it. */
  layer: number;
}

export function ShadowVolumeMask({ light, casters, ordinal, layer }: ShadowVolumeMaskProps) {
  const positions = useMemo(() => buildShadowVolumes(light, casters), [light, casters]);

  const geometry = useMemo(() => {
    if (!positions) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  // R3F does not auto-dispose a geometry handed over as a primitive.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <mesh
      renderOrder={shadowVolumeRenderOrder(ordinal)}
      layers-mask={1 << layer}
      frustumCulled={false}
    >
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        depthTest={false}
        transparent
        side={THREE.DoubleSide}
        stencilWrite
        stencilRef={shadowStencilRef(ordinal)}
        stencilFunc={THREE.AlwaysStencilFunc}
        stencilFail={THREE.ReplaceStencilOp}
        stencilZFail={THREE.ReplaceStencilOp}
        stencilZPass={THREE.ReplaceStencilOp}
      />
    </mesh>
  );
}
