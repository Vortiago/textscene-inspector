/**
 * A PointLight2D's part of the light pass: it declares the light, picks the lists that draw it
 * shadowed or unshadowed, and mounts one quad of its light texture for each role.
 */

import { useState } from 'react';
import type * as THREE from 'three';
import type { PointLightTerm } from './CanvasLight2D';
import { shadowColorContributes } from './lightQuad';
import { usePointShadow } from './shadowMap/usePointShadow';
import { useLightSequence } from './useLightSequence';
import { lightDrawSequence } from './lightSequence';
import { usePassMeshRef, useRegisterCanvasLight2D } from './CanvasLighting2D';
import type { PassMeshRole } from './itemLightList';
import { DEFAULT_LIGHT_CULL_KEY, type LightCullKey } from './lightCullKey';
import { useLightShadowCasters } from './ShadowCasterStage';
import { useLightQuadMaterials } from './useLightQuadMaterials';
import { placePositionalLight, useApartLightOrigin } from './apartLight';
import { useLightRow } from './lightRows';
import { Light2DBlendMode } from '../../godot/scene/light2d';

export function PointLightQuads({ term }: { term: PointLightTerm }) {
  const { shadow } = term;
  // `canvas.glsl:806` shadows only an item whose `light_mask` meets `shadow_item_cull_mask`. With
  // no reached item meeting it, the shadow lands nowhere, so the light casts nothing.
  const shadowReachesItem = (term.itemCullMask & shadow.itemCullMask) !== 0;
  const casters = useLightShadowCasters(shadow.enabled && shadowReachesItem, shadow.itemCullMask);
  const casts = casters.length > 0;
  // The cull tuple, not the node's own `light_mask` (its CanvasItem mask), picks the items this
  // light reaches. Not memoised: the declaration is compared by value.
  const reach: LightCullKey = {
    ...DEFAULT_LIGHT_CULL_KEY,
    itemCullMask: term.itemCullMask,
    zMin: term.zMin,
    zMax: term.zMax,
    layerMin: term.layerMin,
    layerMax: term.layerMax,
  };
  // Godot's default shadow_color is transparent (`light_2d.h:58`), so the extra albedo-free pass
  // runs only for the rare light that tints its shadow.
  const tintsShadow = casts && shadowColorContributes(shadow.color, shadow.filter);
  // Two jobs, two numbers: `ordinal` names the light to the pass (dense, reused on unmount), while
  // `sequence` is this light's position in the canvas light list, which is what Godot applies
  // lights in (`renderer_canvas_render_rd.cpp:2365-2384`) and what order-dependent MIX depends on.
  const listed = useLightSequence();
  const ordinal = useRegisterCanvasLight2D(true, {
    reach,
    sequence: lightDrawSequence(listed, null),
    shadowItemCullMask: casts ? shadow.itemCullMask : null,
    castsShadow: casts,
    tintsShadow,
    mixes: term.blendMode === Light2DBlendMode.MIX,
  });
  const sequence = lightDrawSequence(listed, ordinal);
  // An item the light reaches through a bit outside `shadow_item_cull_mask` takes it unshadowed.
  const reachesUnshadowedItem = (term.itemCullMask & ~shadow.itemCullMask) !== 0;

  // A normal-mapped item shades the light from where its node sits.
  const setOrigin = useApartLightOrigin(ordinal, placePositionalLight, term.height);
  const setRowOrigin = useLightRow(ordinal, term);

  // A callback ref, not useRef, so the pose sampler starts once the quad is in
  // the tree: the world matrix it needs does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const sampling = usePointShadow(quad, casters, {
    filter: shadow.filter,
    smooth: shadow.filterSmooth,
    shadowColor: shadow.color,
  });
  const materials = useLightQuadMaterials({
    cookie: term.cookie,
    color: term.color,
    energy: term.energy,
    blendMode: term.blendMode,
    sampling,
    drawsUnshadowed: casts && reachesUnshadowedItem,
  });

  const image = term.cookie.image as { width?: number; height?: number } | null | undefined;
  const shape = {
    ordinal,
    offset: term.offset,
    width: (image?.width ?? 1) * term.textureScale,
    height: (image?.height ?? 1) * term.textureScale,
    sequence,
  };

  return (
    <>
      <object3D ref={setOrigin} />
      <object3D ref={setRowOrigin} />
      <LightQuad role="lit" onMesh={setQuad} material={materials.lit} {...shape} />
      {materials.unshadowed && <LightQuad role="unshadowed" material={materials.unshadowed} {...shape} />}
    </>
  );
}

/**
 * The lit quad and the unshadowed quad share this component, so their geometry and offset cannot
 * drift. Only their role and material differ. The pass draws the unshadowed quad only for a list on
 * which the light is unshadowed.
 */
function LightQuad({
  ordinal,
  role,
  onMesh,
  material,
  offset,
  width,
  height,
  sequence,
}: {
  /** The light's ordinal, or null while it is undeclared. */
  ordinal: number | null;
  /** Which lists draw the quad: `lit` over the lists that shadow the light, `unshadowed` over the others. */
  role: PassMeshRole;
  /** Receives the mounted mesh, and null on unmount. */
  onMesh?: (mesh: THREE.Mesh | null) => void;
  material: THREE.Material;
  offset: { x: number; y: number };
  width: number;
  height: number;
  /** The render-order slot: the light's place in the canvas light list. */
  sequence: number;
}) {
  const meshRef = usePassMeshRef(ordinal, role, onMesh);

  return (
    <mesh
      ref={meshRef}
      position={[offset.x, -offset.y, 0]}
      material={material}
      // Explicit rather than left to three's depth sort: MIX depends on the light order.
      renderOrder={sequence}
    >
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}
