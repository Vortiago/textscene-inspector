/**
 * A DirectionalLight2D's part of the light pass: it declares the light in its slot of the
 * directional list and mounts one full-screen quad, whose shadow samples a parallel map
 * (`shadowMap/directionalShadowMap.ts`) built over the view. It reaches every lit item on its
 * canvas layers (`canvas.glsl:726`, `renderer_viewport.cpp:679-685`).
 */

import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { DirectionalLightTerm } from './CanvasLight2D';
import { usePassMeshRef, useRegisterCanvasLight2D } from './CanvasLighting2D';
import { directionalRenderOrder } from './lightPassLayers';
import { directionalLightCullKey } from './lightCullKey';
import { useDirectionalLightSlot } from './useLightSequence';
import { useLightShadowCasters } from './ShadowCasterStage';
import type { WorldShadowCaster } from './shadowCasterRegistry';
import { shadowColorContributes } from './lightQuad';
import { useDirectionalShadow } from './shadowMap/directionalShadowView';
import { FullScreenQuad } from './fullScreenQuad';
import { createDirectionalLightMaterial, type DirectionalShadowSampling } from './directionalLightQuad';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { placeDirectionalLight, useApartLightOrigin } from './apartLight';
import { Light2DBlendMode } from '../../godot/scene/light2d';

export function DirectionalLightQuads({ term }: { term: DirectionalLightTerm }) {
  // Null while Godot leaves the light off its directional list: disabled, hidden, or past the
  // eighth light of a canvas (`light_2d.cpp:59`, `renderer_viewport.cpp:492-513`).
  const slot = useDirectionalLightSlot();
  const { shadow } = term;
  const casters = useLightShadowCasters(shadow.enabled, shadow.itemCullMask);
  // Its shadow reaches every item it lights, so it declares no `shadow_item_cull_mask`.
  const tintsShadow = casters.length > 0 && shadowColorContributes(shadow.color, shadow.filter);
  const ordinal = useRegisterCanvasLight2D(slot !== null, {
    reach: directionalLightCullKey(term.layerMin, term.layerMax),
    sequence: null,
    slot: slot ?? undefined,
    shadowItemCullMask: null,
    tintsShadow,
    mixes: term.blendMode === Light2DBlendMode.MIX,
  });

  if (slot === null) return null;
  return (
    <DirectionalQuad
      term={term}
      ordinal={ordinal}
      renderOrder={directionalRenderOrder(slot)}
      casters={casters}
    />
  );
}

function DirectionalQuad({
  term,
  ordinal,
  renderOrder,
  casters,
}: {
  term: DirectionalLightTerm;
  /** This light's ordinal on the canvas, or null while undeclared. */
  ordinal: number | null;
  /** Its draw order, from its slot in the directional list. */
  renderOrder: number;
  /** The occluders this light is allowed to see, in world space. */
  casters: readonly WorldShadowCaster[];
}) {
  const { shadow } = term;
  // A normal-mapped item shades the light from the way its node points.
  const setOrigin = useApartLightOrigin(ordinal, placeDirectionalLight, term.height);

  // Held in state, so the shadow starts once the quad is in the tree: the light's world matrix
  // does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const { map: shadowMap, ndcToShadow } = useDirectionalShadow(quad, casters, term.maxDistance);
  const hasMap = quad !== null && casters.length > 0;
  const sampling = useMemo<DirectionalShadowSampling | undefined>(
    () =>
      hasMap
        ? {
            map: shadowMap,
            filter: shadow.filter,
            smooth: shadow.filterSmooth,
            ndcToShadow,
            shadowColor: shadow.color,
          }
        : undefined,
    [hasMap, shadowMap, shadow.filter, shadow.filterSmooth, ndcToShadow, shadow.color]
  );

  const { color, energy, blendMode } = term;
  const material = useMemo(
    () => createDirectionalLightMaterial({ color, energy, blendMode, shadow: sampling }),
    [color, energy, blendMode, sampling]
  );
  useDisposeOnRelease(material);

  const litRef = usePassMeshRef<THREE.Mesh>(ordinal, 'lit', setQuad);

  return (
    <>
      <object3D ref={setOrigin} />
      <FullScreenQuad meshRef={litRef} material={material} renderOrder={renderOrder} />
    </>
  );
}
