/**
 * `<ShadowVolumeMask>`: the stencil half of an unfiltered shadowed 2D light. It draws the light's
 * shadow volumes with colour writes off, stamping a stencil value its cookie quad rejects through
 * `litQuadStencilProps(ordinal)`. A PCF5/PCF13 shadow is a fraction no stencil carries, so a filtered
 * light samples `shadowPolarMap` (ADR-0030) over the whole rect and uses only the render-order helpers.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildShadowVolumes, type ShadowCasterEdges, type ShadowLight } from './shadowVolumes';
import { canvasItemFacing } from '../canvasItemFacing';
import { materialProgramInputs } from '../materialProgramInputs';

/**
 * Distinct stencil values in one pass. The buffer is 8-bit and 0 is the cleared state, so refs run
 * 1..255 and wrap: exact up to this many shadowed lights, and beyond it a pass needs a stencil
 * clear every 255 lights.
 */
export const SHADOW_STENCIL_REFS = 255;

/**
 * The stencil value light `ordinal` stamps, distinct per light in a pass. The lights share one
 * target, so a shared ref would make each cookie reject every earlier light's shadow. A distinct
 * ref makes a leftover stamp unequal, so one stencil clear per pass suffices.
 */
export function shadowStencilRef(ordinal: number): number {
  const n = Math.abs(Math.trunc(ordinal)) % SHADOW_STENCIL_REFS;
  return n + 1;
}

/**
 * Render order for a light's volumes, just before its own quad. It takes the light's place in the
 * canvas light list (`lightSequence.ts`), not its ordinal: Godot applies lights in attach order,
 * MIX depends on it, and ordinals follow cookie load timing.
 */
export function shadowVolumeRenderOrder(sequence: number): number {
  return sequence * 2;
}

/** Render order for a light's cookie quad, just after its own volumes. */
export function litQuadRenderOrder(sequence: number): number {
  return sequence * 2 + 1;
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

/**
 * Spread onto the `shadow_color` quad's material so it covers exactly the region
 * the lit quad skips. Same ref, `Equal` where the lit quad is `NotEqual`, so the
 * pair partitions the light's rect once, with no seam and no doubled pixel.
 */
export function shadowColorQuadStencilProps(ordinal: number) {
  return {
    ...litQuadStencilProps(ordinal),
    stencilFunc: THREE.EqualStencilFunc,
  } as const;
}

export interface ShadowVolumeMaskProps {
  /** Shadow origin and the rect the light reaches, in the previewer's 2D world space. */
  light: ShadowLight;
  /** `worldShadowCasters` filtered by this light's `shadow_item_cull_mask`. */
  casters: readonly ShadowCasterEdges[];
  /**
   * This light's index within the pass. Only distinctness matters, not order or
   * density; two lights sharing an ordinal shadow each other.
   */
  ordinal: number;
  /** This light's place in the canvas light list: its render-order slot. */
  sequence: number;
  /** The layer the light's cookie quad draws on, which the mask shares. */
  layer: number;
  /**
   * The `shadow_color` layer, when this light tints its shadow. The stamp has to
   * exist in that pass too: it renders the tint quad without the cookie quads,
   * and the tint quad tests the very stencil this mesh writes.
   */
  tintLayer?: number | undefined;
}

export function ShadowVolumeMask({ light, casters, ordinal, sequence, layer, tintLayer }: ShadowVolumeMaskProps) {
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

  const program = materialProgramInputs({
    props: {
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      // An additive cookie quad is transparent, and three draws the opaque group first, so an
      // opaque mask would stamp every light's volumes before any cookie. `renderOrder` interleaves
      // only within one group, and three's transparent sort puts it ahead of z.
      transparent: true,
      stencilWrite: true,
      stencilRef: shadowStencilRef(ordinal),
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
    },
    // A volume fans `[a, b, bFar, mFar, aFar]` (`shadowVolumes.ts`), so its winding follows its
    // edge's direction about the light, and `CULL_DISABLED` admits both. `ReplaceStencilOp` is
    // idempotent, so a doubled draw stamps the same value. An incrementing op would corrupt it.
    merge: [canvasItemFacing()],
  });

  return (
    <mesh
      renderOrder={shadowVolumeRenderOrder(sequence)}
      layers-mask={(1 << layer) | (tintLayer === undefined ? 0 : 1 << tintLayer)}
      frustumCulled={false}
      // `light` and `casters` are world coordinates, so the mesh stays at the identity, or the
      // CanvasItem chain applies twice. three's `updateMatrixWorld` recurses only into a child
      // that opts in, so nothing forces an update past this flag.
      matrixWorldAutoUpdate={false}
    >
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
