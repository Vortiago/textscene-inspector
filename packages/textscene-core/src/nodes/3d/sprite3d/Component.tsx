/**
 * <Sprite3D> — billboarded 2D texture rendered in 3D space.
 *
 * Architecture:
 *   - Texture state machine: `useResource('Texture2D')` against the
 *     resolved ExtResource path. Pending → render nothing (lets the
 *     scene continue); missing/error → magenta placeholder mesh +
 *     drei `<Text>` label naming the path (matches MeshInstance3D UX).
 *   - Quad geometry: `<planeGeometry>` sized by `pixel_size` × the
 *     active texture region (full image, sprite-sheet tile, or
 *     `region_rect` sub-image). Same pattern as Label3D's textured
 *     plane, but the texture comes from the host file provider rather
 *     than a runtime canvas rasteriser.
 *   - UV math: region_rect + hframes/vframes composition lives in the
 *     shared `r3f/spriteFrame` module (one home for Sprite2D +
 *     Sprite3D). flip_h/flip_v stay here — 3D mirrors via UV negation
 *     where 2D mirrors via mesh scale.
 *
 * Material:
 *   - `meshBasicMaterial` (sprites are unlit in Godot)
 *   - `color`     ← modulate RGB
 *   - `opacity`   ← clamp01(modulate.a * (1 - transparency)),
 *                   `transparent` flag follows
 *   - `alphaTest` ← non-zero when alpha_cut === DISCARD (Godot
 *                   doesn't expose the threshold; 0.5 is the Godot
 *                   default for `alpha_scissor_threshold`)
 *   - `depthWrite`← false except in DISCARD mode (sharp-edge pass)
 *   - `side`      ← DoubleSide (sprite quads should be visible from
 *                   the back too — Godot's runtime behaviour)
 *   - `renderOrder` on the mesh ← render_priority
 *
 * Billboard handling is deferred to a runtime per-frame look-at via
 * `mesh.userData.billboardMode` (the same convention Label3D uses).
 * Wiring the runtime billboarding loop is a separate concern; this
 * component just persists the mode and axis so the consumer can act.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { composeFrameTexture, frameSizePx } from '../../../r3f/spriteFrame';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { resolveTexture2DPath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import {
  AlphaCutMode,
  type Sprite3DProperties,
} from './types';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';

const DEFAULT_ALPHA_TEST = 0.5;

export function Sprite3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as Sprite3DProperties;
  const { externalResources, internalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // Resolve `texture = ExtResource("id")` → res:// path via the scene's
  // external-resource table. Empty string short-circuits the hook (per
  // useResource's contract) so we keep the hook-call count stable when
  // texture is absent.
  const texturePath = useMemo(
    () => resolveTexture2DPath(properties.texture, externalResources, internalResources),
    [properties.texture, externalResources, internalResources]
  );

  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  // Compose the visible texture (shared spriteFrame module clones + windows
  // the UVs to the region/frame), then mirror via UV negation: flip the
  // (already cropped) UV window by negating the repeat and shifting the
  // offset to the opposite edge.
  const displayedTexture = useMemo(() => {
    const cloned = composeFrameTexture(texResult.value, properties);
    if (!cloned) return undefined;
    if (properties.flip_h) {
      cloned.offset.x += cloned.repeat.x;
      cloned.repeat.x = -cloned.repeat.x;
    }
    if (properties.flip_v) {
      cloned.offset.y += cloned.repeat.y;
      cloned.repeat.y = -cloned.repeat.y;
    }
    return cloned;
  }, [texResult.value, properties]);

  // Quad sizing: pixel_size × the frame's pixel dimensions (1×1 fallback
  // before the image loads keeps the placeholder at expected scale).
  const { width, height } = useMemo(() => {
    const px = frameSizePx(texResult.value, properties);
    return { width: px.width * properties.pixel_size, height: px.height * properties.pixel_size };
  }, [texResult.value, properties]);

  // Modulate RGB and effective opacity. Transparency property is
  // additive: opacity = modulate.a * (1 - transparency). Godot stores modulate
  // in sRGB → convert to the linear working space before the unlit material
  // (matching Sprite2D / WorldEnvironment).
  const color = useGodotLinearColor(properties.modulate);
  const opacity = clamp01(properties.modulate.a * (1 - properties.transparency));
  // `transparent=false` (Godot) ignores texture alpha entirely → opaque quad.
  const transparent =
    properties.transparent === false
      ? false
      : opacity < 1 || properties.alpha_cut !== AlphaCutMode.ALPHA_CUT_DISABLED;

  // Alpha-cut → material configuration:
  //   DISABLED       → standard alpha blending; depthWrite off.
  //   DISCARD        → alphaTest threshold; depthWrite ON (sharp edges).
  //   OPAQUE_PREPASS → same as DISCARD for now (no separate prepass).
  const { alphaTest: alphaCutTest, depthWrite: alphaCutDepthWrite } = alphaCutBehaviour(properties.alpha_cut);
  const alphaTest = properties.transparent === false ? 0 : alphaCutTest;
  // An opaque sprite must write depth so it occludes and sorts correctly
  // against other opaque geometry; only the blended (transparent) paths skip
  // depthWrite. Without this an opaque `transparent=false` sprite kept the
  // DISABLED alpha-cut's depthWrite=false and rendered with wrong ordering.
  const depthWrite = transparent ? alphaCutDepthWrite : true;

  // Quad origin: centered (default) puts the plane center at the node origin;
  // centered=false puts the top-left there. `offset` shifts in sprite pixels
  // (× pixel_size; Godot screen-Y is down → negated). Baked into the geometry
  // so it stays correct under the node's rotation/billboard.
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(width, height);
    const ox = properties.offset.x * properties.pixel_size + (properties.centered ? 0 : width / 2);
    const oy = -properties.offset.y * properties.pixel_size - (properties.centered ? 0 : height / 2);
    if (ox !== 0 || oy !== 0) geom.translate(ox, oy, 0);
    return geom;
  }, [width, height, properties.offset.x, properties.offset.y, properties.centered, properties.pixel_size]);
  // We pass `geometry` via `<primitive>`, which R3F does NOT auto-dispose (only
  // JSX-declared geometries are managed) — release the GPU buffers ourselves
  // when a new one replaces it / on unmount.
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Descendants ride in a SIBLING group carrying the same transform rather
  // than inside the sprite quad: `billboard` re-aims the quad at the camera,
  // and in Godot that is a shader-side effect on the sprite alone — it never
  // spins the node's children. Every branch below renders it, including the
  // placeholder and pending ones, so a missing or slow texture cannot delete
  // the subtree parented under the sprite.
  const subtree =
    children === undefined ? null : (
      <group position={position} rotation={rotation} scale={scale}>
        {children}
      </group>
    );

  // No texture path requested at all: render a stub placeholder so users
  // see that the sprite node exists in the scene even without a texture.
  // (Linter would already flag this as `sprite3d-requires-texture`.)
  if (!texturePath) {
    return (
      <>
        <MissingResourcePlaceholder
          shape="plane"
          name={node.name}
          position={position}
          rotation={rotation}
          scale={scale}
        />
        {subtree}
      </>
    );
  }

  // Texture failed to load: magenta-quad placeholder. The in-3D path
  // label was moved to the DOM `<MissingResourcesPanel>`.
  if (texResult.status === 'unavailable') {
    return (
      <>
        <MissingResourcePlaceholder
          shape="plane"
          name={node.name}
          position={position}
          rotation={rotation}
          scale={scale}
        />
        {subtree}
      </>
    );
  }

  // Pending: render nothing visible yet. Wait for the texture to arrive
  // (which `useResource` will pick up automatically on the next render
  // cycle once the host provides the file).
  if (!displayedTexture) {
    return (
      <>
        <group
          name={node.name}
          position={position}
          rotation={rotation}
          scale={scale}
          userData={{ billboardMode: properties.billboard, billboardAxis: properties.axis }}
        />
        {subtree}
      </>
    );
  }

  return (
    <>
      <mesh
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        renderOrder={properties.render_priority}
        userData={{ billboardMode: properties.billboard, billboardAxis: properties.axis }}
      >
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial
          map={displayedTexture}
          color={color}
          opacity={opacity}
          transparent={transparent}
          alphaTest={alphaTest}
          depthWrite={depthWrite}
          side={properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide}
        />
      </mesh>
      {subtree}
    </>
  );
}

function alphaCutBehaviour(mode: AlphaCutMode): { alphaTest: number; depthWrite: boolean } {
  switch (mode) {
    case AlphaCutMode.ALPHA_CUT_DISCARD:
    case AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS:
      return { alphaTest: DEFAULT_ALPHA_TEST, depthWrite: true };
    case AlphaCutMode.ALPHA_CUT_DISABLED:
    default:
      return { alphaTest: 0, depthWrite: false };
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
