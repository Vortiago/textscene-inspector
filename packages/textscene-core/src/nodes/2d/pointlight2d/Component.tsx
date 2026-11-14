/**
 * PointLight2D draws nothing on the canvas, as in Godot: it adds its cookie to
 * the accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLighting2D`). CanvasItem2D supplies transform, `visible` and z.
 */

import { useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useNodeReference } from '../../../resources/reading';
import type { ViewSampler } from '../../../resources/textures/textureView';
import { useTextureView } from '../../../r3f/useTextureView';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { PointLight2DProperties } from './types';
import { shadowColorContributes } from '../../../r3f/lighting2d/lightQuad';
import { usePointShadow } from '../../../r3f/lighting2d/shadowMap/usePointShadow';
import { useLightSequence } from '../../../r3f/lighting2d/useLightSequence';
import { lightDrawSequence } from '../../../r3f/lighting2d/lightSequence';
import { usePassMeshRef, useRegisterCanvasLight2D } from '../../../r3f/lighting2d/CanvasLighting2D';
import type { PassMeshRole } from '../../../r3f/lighting2d/itemLightList';
import { DEFAULT_LIGHT_CULL_KEY, type LightCullKey } from '../../../r3f/lighting2d/lightCullKey';
import { useLightShadowCasters } from '../../../r3f/lighting2d/ShadowCasterStage';
import type { WorldShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';
import { useLightQuadMaterials } from './useLightQuadMaterials';
import { placePositionalLight, useApartLightOrigin } from '../../../r3f/lighting2d/apartLight';
import type { Rgba } from '../../../godot/math/math';
import { Light2DBlendMode, type Light2DShadowFilter } from '../../../godot/scene/light2d.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/**
 * Godot resolves a canvas item's DEFAULT repeat to the viewport's DISABLED default
 * (`viewport.h:419-420`, `renderer_canvas_render_rd.cpp:2344`), and the light-texture
 * tap uses that item sampler (`canvas.glsl:774-782`). The cookie states clamp and never
 * inherits a Repeat from the shared producer; a clamp-tagged entry is reused as-is.
 */
const COOKIE_SAMPLER: ViewSampler = { colorSpace: THREE.NoColorSpace, wrap: THREE.ClampToEdgeWrapping };

export function PointLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as PointLight2DProperties;

  // `useTexture2D` resolves a GradientTexture2D, a gradient-less one to Godot's placeholder at its
  // own size (`renderer_viewport.cpp:455-460`). The plain view, as `COOKIE_SAMPLER` reads texels raw.
  const scope = useSceneResources();
  const slot = useTexture2D(useNodeReference(props.texture, scope), 'plain');
  // A light that draws no quad makes no view: it would clone and upload a cookie nothing draws.
  const cookie = useTextureView(props.enabled && !slot.missing ? slot.texture : null, COOKIE_SAMPLER);

  // With no texture the light adds nothing and draws no placeholder: measured with `pnpm ref:godot`.
  const lights = props.enabled && !!slot.texture;
  // `canvas.glsl:806` shadows only an item whose `light_mask` meets `shadow_item_cull_mask`. With
  // no reached item meeting it, the shadow lands nowhere, so the light casts nothing.
  const shadowReachesItem = (props.range_item_cull_mask & props.shadow_item_cull_mask) !== 0;
  const shadowEnabled = props.shadow_enabled && shadowReachesItem;
  const casters = useLightShadowCasters(shadowEnabled, props.shadow_item_cull_mask);
  const casts = casters.length > 0;
  // The cull tuple, not the node's own `light_mask` (its CanvasItem mask), picks the items this
  // light reaches. Not memoised: the declaration is compared by value.
  const reach: LightCullKey = {
    ...DEFAULT_LIGHT_CULL_KEY,
    itemCullMask: props.range_item_cull_mask,
    zMin: props.range_z_min,
    zMax: props.range_z_max,
    layerMin: props.range_layer_min,
    layerMax: props.range_layer_max,
  };
  // Godot's default shadow_color is transparent (`light_2d.h:58`), so the extra albedo-free pass
  // runs only for the rare light that tints its shadow.
  const tintsShadow = casts && shadowColorContributes(props.shadow_color, props.shadow_filter);
  // Two jobs, two numbers: `ordinal` names the light to the pass (dense, reused on unmount), while
  // `sequence` is this light's position in the canvas light list, which is what Godot applies
  // lights in (`renderer_canvas_render_rd.cpp:2365-2384`) and what order-dependent MIX depends on.
  const listed = useLightSequence();
  const ordinal = useRegisterCanvasLight2D(lights, {
    reach,
    sequence: lightDrawSequence(listed, null),
    shadowItemCullMask: casts ? props.shadow_item_cull_mask : null,
    tintsShadow,
    mixes: props.blend_mode === Light2DBlendMode.MIX,
  });
  const sequence = lightDrawSequence(listed, ordinal);
  // An item the light reaches through a bit outside `shadow_item_cull_mask` takes it unshadowed.
  const reachesUnshadowedItem = (props.range_item_cull_mask & ~props.shadow_item_cull_mask) !== 0;

  // A normal-mapped item shades the light from where its node sits.
  const setOrigin = useApartLightOrigin(ordinal, placePositionalLight, props.height);

  // A disabled light still draws its children: `enabled` switches the light alone.
  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={() =>
        !props.enabled ? null : slot.missing ? (
          <MissingResourcePlaceholder shape="plane" name={node.name} />
        ) : cookie ? (
          <>
            <object3D ref={setOrigin} />
            <QuadMesh
              cookie={cookie}
              color={props.color}
              energy={props.energy}
              scale={props.texture_scale}
              offset={props.offset}
              blendMode={props.blend_mode}
              shadowColor={props.shadow_color}
              shadowFilter={props.shadow_filter}
              shadowFilterSmooth={props.shadow_filter_smooth}
              ordinal={ordinal}
              sequence={sequence}
              reachesUnshadowedItem={reachesUnshadowedItem}
              casters={casters}
            />
          </>
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
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

function QuadMesh({
  cookie,
  color,
  energy,
  scale,
  offset,
  blendMode,
  shadowColor,
  shadowFilter,
  shadowFilterSmooth,
  ordinal,
  sequence,
  reachesUnshadowedItem,
  casters,
}: {
  cookie: THREE.Texture;
  color: Rgba;
  energy: number;
  scale: number;
  offset: { x: number; y: number };
  blendMode: number;
  /** `Light2D.shadow_color`: what this light contributes where it is blocked. */
  shadowColor: Rgba;
  /** `Light2D.shadow_filter`: the taps the polar map is read with. */
  shadowFilter: EnumValue<typeof Light2DShadowFilter>;
  /** `Light2D.shadow_filter_smooth`: how wide the PCF taps spread the boundary. */
  shadowFilterSmooth: number;
  /** Whether an item the light reaches can miss `shadow_item_cull_mask`. */
  reachesUnshadowedItem: boolean;
  /** This light's ordinal on the canvas, or null while undeclared. */
  ordinal: number | null;
  /** This light's place in the canvas light list, which is its draw order. */
  sequence: number;
  /** The occluders this light is allowed to see, in world space. */
  casters: readonly WorldShadowCaster[];
}) {
  const width = (cookie.image as { width?: number } | null | undefined)?.width ?? 1;
  const height = (cookie.image as { height?: number } | null | undefined)?.height ?? 1;

  // A callback ref, not useRef, so the pose sampler starts once the quad is in
  // the tree: the world matrix it needs does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const sampling = usePointShadow(quad, casters, {
    filter: shadowFilter,
    smooth: shadowFilterSmooth,
    shadowColor,
  });

  const materials = useLightQuadMaterials({
    cookie,
    color,
    energy,
    blendMode,
    sampling,
    drawsUnshadowed: casters.length > 0 && reachesUnshadowedItem,
  });

  const shape = { ordinal, offset, width: width * scale, height: height * scale, sequence };

  return (
    <>
      <LightQuad role="lit" onMesh={setQuad} material={materials.lit} {...shape} />
      {materials.unshadowed && <LightQuad role="unshadowed" material={materials.unshadowed} {...shape} />}
    </>
  );
}
