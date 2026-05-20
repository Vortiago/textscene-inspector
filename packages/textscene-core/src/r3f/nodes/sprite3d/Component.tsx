/**
 * <Sprite3D> — billboarded 2D texture rendered in 3D space.
 *
 * Architecture:
 *   - Texture state machine: `useResource('Texture2D')` against the
 *     resolved ExtResource path. Pending → render nothing (lets the
 *     scene continue); missing/error → magenta placeholder mesh +
 *     drei `<Text>` label naming the path (matches MeshInstance3D UX
 *     from WI-R3F-7).
 *   - Quad geometry: `<planeGeometry>` sized by `pixel_size` × the
 *     active texture region (full image, sprite-sheet tile, or
 *     `region_rect` sub-image). Same pattern as Label3D's textured
 *     plane, but the texture comes from the host file provider rather
 *     than a runtime canvas rasteriser.
 *   - Spritesheet UV math (the load-bearing new logic):
 *       repeat = (1/hframes, 1/vframes)
 *       offset = ((frame % hframes) / hframes,
 *                 1 - Math.ceil((frame+1)/hframes) / vframes)
 *     `frame_coords` overrides the linear frame index when present.
 *     `region_enabled + region_rect` overrides the spritesheet math
 *     with an explicit sub-rectangle of the texture (requires the
 *     texture's `image` to expose `width`/`height`; otherwise the
 *     sub-rect is skipped and the full texture is used).
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

import { useMemo } from 'react';
import * as THREE from 'three';
import type {
  TscnExternalResource,
} from '../../../parser/types';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import { useSceneResources } from '../../SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import {
  AlphaCutMode,
  type Sprite3DProperties,
} from '../../../nodes/3d/sprite3d/types';

const DEFAULT_ALPHA_TEST = 0.5;

export function Sprite3D({ node }: NodeComponentProps) {
  const properties = node.properties as Sprite3DProperties;
  const { externalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // Resolve `texture = ExtResource("id")` → res:// path via the scene's
  // external-resource table. Empty string short-circuits the hook (per
  // useResource's contract) so we keep the hook-call count stable when
  // texture is absent.
  const texturePath = useMemo(
    () => resolveTexturePath(properties.texture, externalResources),
    [properties.texture, externalResources]
  );

  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  // Compose the visible texture: apply spritesheet UV (frame / hframes /
  // vframes / frame_coords) or region_rect to a clone of the loaded
  // texture so multiple sprites sharing the same path don't fight over
  // each other's repeat/offset state.
  const displayedTexture = useMemo(
    () => composeTexture(texResult.value, properties),
    [texResult.value, properties]
  );

  // Quad sizing: pixel_size × the visible image dimensions. Without a
  // loaded image we fall back to a 1×1 default so the placeholder is
  // still visible at expected scale.
  const { width, height } = useMemo(
    () => computeQuadSize(texResult.value, properties),
    [texResult.value, properties]
  );

  // Modulate RGB and effective opacity. Transparency property is
  // additive: opacity = modulate.a * (1 - transparency).
  const color = useMemo(
    () => new THREE.Color(properties.modulate.r, properties.modulate.g, properties.modulate.b),
    [properties.modulate.r, properties.modulate.g, properties.modulate.b]
  );
  const opacity = clamp01(properties.modulate.a * (1 - properties.transparency));
  const transparent = opacity < 1 || properties.alpha_cut !== AlphaCutMode.ALPHA_CUT_DISABLED;

  // Alpha-cut → material configuration:
  //   DISABLED       → standard alpha blending; depthWrite off.
  //   DISCARD        → alphaTest threshold; depthWrite ON (sharp edges).
  //   OPAQUE_PREPASS → same as DISCARD for now (no separate prepass).
  const { alphaTest, depthWrite } = alphaCutBehaviour(properties.alpha_cut);

  // No texture path requested at all: render a stub placeholder so users
  // see that the sprite node exists in the scene even without a texture.
  // (Linter would already flag this as `sprite3d-requires-texture`.)
  if (!texturePath) {
    return (
      <Placeholder
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        label="Sprite3D missing texture"
      />
    );
  }

  // Texture failed to load: magenta-quad placeholder + drei label.
  if (texResult.status === 'missing' || texResult.status === 'error') {
    return (
      <Placeholder
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        label={`${texturePath} missing`}
      />
    );
  }

  // Pending: render nothing visible yet. Wait for the texture to arrive
  // (which `useResource` will pick up automatically on the next render
  // cycle once the host provides the file).
  if (!displayedTexture) {
    return (
      <group
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        userData={{ billboardMode: properties.billboard, billboardAxis: properties.axis }}
      />
    );
  }

  return (
    <mesh
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      renderOrder={properties.render_priority}
      userData={{ billboardMode: properties.billboard, billboardAxis: properties.axis }}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={displayedTexture}
        color={color}
        opacity={opacity}
        transparent={transparent}
        alphaTest={alphaTest}
        depthWrite={depthWrite}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface PlaceholderProps {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  /**
   * Retained in the interface so call sites still pass the label string —
   * it's not rendered in 3D (Gap 12), but it's used by upstream code paths
   * and may be consumed by future selection UI / tooltips.
   */
  label: string;
}

function Placeholder({ name, position, rotation, scale }: PlaceholderProps) {
  // Gap 12 (WI-UX-3): the in-3D text label is redundant once the DOM
  // missing-resources panel surfaces the same info without clipping.
  return (
    <group name={name} position={position} rotation={rotation} scale={scale}>
      <mesh>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="magenta" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Resolve a Sprite3D `texture` reference. ExtResource ids are looked up
 * in the scene's externalResources table; SubResource refs are NOT
 * supported today (a textures-as-SubResource pattern would require a
 * separate StreamTexture parser).
 */
function resolveTexturePath(
  textureRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!textureRef) return null;
  if (textureRef.startsWith('res://')) return textureRef;
  const parsed = parseResourceReference(textureRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = externalResources.find((r) => r.id === parsed.id);
  return ext?.path ?? null;
}

/**
 * Clone the loaded texture and apply spritesheet UV math (and/or
 * region_rect cropping). The clone is essential: `useResource` returns
 * the same THREE.Texture reference to every consumer of a given path,
 * so mutating in place would clobber other sprites' UV settings.
 *
 * Returns undefined when no texture is loaded yet.
 */
function composeTexture(
  texture: THREE.Texture | undefined,
  properties: Sprite3DProperties
): THREE.Texture | undefined {
  if (!texture) return undefined;

  const cloned = texture.clone();
  cloned.wrapS = THREE.RepeatWrapping;
  cloned.wrapT = THREE.RepeatWrapping;

  // region_enabled wins over spritesheet math when both are set — it's
  // an explicit user-defined sub-rectangle, less likely to be a mistake.
  if (properties.region_enabled && properties.region_rect) {
    applyRegionRect(cloned, properties.region_rect);
  } else if (properties.hframes > 1 || properties.vframes > 1) {
    applySpritesheetUV(cloned, properties);
  }

  cloned.needsUpdate = true;
  return cloned;
}

function applySpritesheetUV(
  texture: THREE.Texture,
  properties: Sprite3DProperties
): void {
  const H = Math.max(1, properties.hframes);
  const V = Math.max(1, properties.vframes);

  // frame_coords overrides the linear `frame` index when present.
  let col: number;
  let row: number;
  if (properties.frame_coords) {
    col = properties.frame_coords.x;
    row = properties.frame_coords.y;
  } else {
    const N = properties.frame;
    col = N % H;
    row = Math.floor(N / H);
  }

  texture.repeat.set(1 / H, 1 / V);
  // UV-Y origin is bottom-left in three.js; image-Y origin is top-left.
  // Flip Y so row 0 sits at the top of the texture (intuitive layout).
  texture.offset.set(col / H, 1 - (row + 1) / V);
}

function applyRegionRect(
  texture: THREE.Texture,
  rect: { x: number; y: number; width: number; height: number }
): void {
  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image || !image.width || !image.height) {
    // Without dimensions we can't compute a sensible sub-rectangle. The
    // caller's sprite will render with the full texture; the linter
    // already warns when region_rect is set without region_enabled.
    return;
  }
  const imgW = image.width;
  const imgH = image.height;
  texture.repeat.set(rect.width / imgW, rect.height / imgH);
  texture.offset.set(rect.x / imgW, 1 - (rect.y + rect.height) / imgH);
}

/**
 * Quad size in world units. Three branches:
 *   1. Region enabled + texture image dims known → use rect dimensions.
 *   2. Spritesheet → use (imgW / hframes, imgH / vframes).
 *   3. Otherwise → use full image dimensions (or a 1×1 default).
 * All multiplied by `pixel_size`.
 */
function computeQuadSize(
  texture: THREE.Texture | undefined,
  properties: Sprite3DProperties
): { width: number; height: number } {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  const imgW = image?.width ?? 1;
  const imgH = image?.height ?? 1;

  let pxW = imgW;
  let pxH = imgH;

  if (properties.region_enabled && properties.region_rect && image?.width && image?.height) {
    pxW = properties.region_rect.width;
    pxH = properties.region_rect.height;
  } else if (properties.hframes > 1 || properties.vframes > 1) {
    pxW = imgW / Math.max(1, properties.hframes);
    pxH = imgH / Math.max(1, properties.vframes);
  }

  return {
    width: pxW * properties.pixel_size,
    height: pxH * properties.pixel_size,
  };
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
