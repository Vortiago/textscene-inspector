/**
 * `<NinePatchRect>` — the native (WebGL canvas) painter: a hand-built
 * `BufferGeometry` from `ninePatchGeometry.ts` (this node's own `texture`,
 * `patch_margin_*`, `region_rect` and `axis_stretch_*` translated to that
 * module's primitive nine-patch shape), textured through `useTexture2D` so an
 * image file and an inline procedural texture reach it the same way —
 * `nodes/2d/ui/texturerect/Component.tsx` is the precedent for both that
 * resolution and the `NoColorSpace` + `ControlQuad`-style decode this mirrors
 * (a bespoke mesh rather than `<ControlQuad>` itself, since that component is
 * a single quad and a nine-patch draws several).
 *
 * Positions come out of `ninePatchGeometry` in Godot pixels, +Y down,
 * dest-rect-local — the same uncooked convention `styleBoxFlatGeometry`
 * documents — so this mesh sits in a `scale={[1,-1,1]}` group exactly like
 * `<StyleBoxQuad>`.
 *
 * Tint: the walker's own `tint` prop — `self_modulate` already folded onto
 * the inherited `modulate`. NinePatchRect has no base colour of its own to
 * fold in first (its `canvas_item_add_nine_patch` call passes no `p_modulate`
 * of its own, `nine_patch_rect.cpp:48` — unlike `StyleBoxTexture::draw`,
 * which bakes its OWN `modulate` member into that same call's final
 * argument, `style_box_texture.cpp:183`), so it is used as-is, same as
 * TextureRect.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { pinNoColorSpace, useCanvasDecodeDefines } from '../../../../r3f/canvas2DTextureDecode';
import { useInheritedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { canvasItemFacing } from '../../../../r3f/canvasItemFacing';
import { materialProgramInputs } from '../../../../r3f/materialProgramInputs';
import { useTexture2D } from '../../../../resources/useTexture2D';
import {
  ninePatchGeometry,
  NINE_PATCH_STRETCH,
  type NinePatchAxisMode,
  type NinePatchGeometryBuffers,
} from '../../../../r3f/controls/native/ninePatchGeometry';
import { resolveNinePatchFilter } from './nativeSolver';
import type { NinePatchRectProperties } from './types';

const FILTER: Record<'nearest' | 'linear', THREE.MagnificationTextureFilter> = {
  nearest: THREE.NearestFilter,
  linear: THREE.LinearFilter,
};

interface ImageLike {
  width?: number;
  height?: number;
}

function toAxisMode(value: number | undefined): NinePatchAxisMode {
  return value === 1 || value === 2 ? value : NINE_PATCH_STRETCH;
}

function buildGeometry(buffers: NinePatchGeometryBuffers): THREE.BufferGeometry | null {
  if (buffers.positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffers.positions), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buffers.uvs), 2));
  geometry.setIndex(buffers.indices);
  return geometry;
}

export function NinePatchRect({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<NinePatchRectProperties>(solveNode);
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);

  // The node's OWN scope, not the ambient provider's — a NinePatchRect that
  // arrived through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;
  const { texture: rawTexture } = useTexture2D(props.texture, externalResources, internalResources);

  const geometry = useMemo(() => {
    const image = rawTexture?.image as ImageLike | undefined;
    const textureSize = { x: image?.width ?? 0, y: image?.height ?? 0 };
    if (!rawTexture || textureSize.x <= 0 || textureSize.y <= 0) return null;

    const region = props.regionRect;
    // `region_rect != Rect2()` (`renderer_canvas_render_rd.cpp`'s nine-patch
    // batch setup) — an ALL-zero region (including the parsed default, which
    // never sets it) means "the whole texture", not a zero-size crop.
    const regionSet = region !== undefined && (region.x !== 0 || region.y !== 0 || region.width !== 0 || region.height !== 0);
    const regionOffset = regionSet ? { x: region!.x, y: region!.y } : { x: 0, y: 0 };
    const regionSize = regionSet ? { x: region!.width, y: region!.height } : textureSize;

    const buffers = ninePatchGeometry({
      rectSize: { x: rect.w, y: rect.h },
      textureSize,
      regionOffset,
      regionSize,
      margin: {
        left: props.patchMarginLeft ?? 0,
        top: props.patchMarginTop ?? 0,
        right: props.patchMarginRight ?? 0,
        bottom: props.patchMarginBottom ?? 0,
      },
      axisH: toAxisMode(props.axisStretchHorizontal),
      axisV: toAxisMode(props.axisStretchVertical),
      // `bool draw_center = true` (`nine_patch_rect.h:45`).
      drawCenter: props.drawCenter ?? true,
    });
    return buildGeometry(buffers);
  }, [
    rawTexture,
    rect.w,
    rect.h,
    props.regionRect,
    props.patchMarginLeft,
    props.patchMarginTop,
    props.patchMarginRight,
    props.patchMarginBottom,
    props.axisStretchHorizontal,
    props.axisStretchVertical,
    props.drawCenter,
  ]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  // Clone: the resolved texture is a SHARED cache entry, mutated per-consumer
  // below (colour space, filter) — the same reason TextureRect's own painter
  // clones (`texturerect/Component.tsx`).
  const preparedTexture = useMemo(() => {
    if (!rawTexture || !geometry) return null;
    const cloned = rawTexture.clone();
    pinNoColorSpace(cloned);
    const filter = FILTER[resolveNinePatchFilter(sampler.filter)];
    cloned.magFilter = filter;
    cloned.minFilter = filter;
    // Every UV this module emits stays inside the sampled texture/region by
    // construction (no wraparound sampling — TILE/TILE_FIT are discrete
    // repeated quads, not a repeat-wrapped sampler), so a clamp is always
    // correct here regardless of the item's own `texture_repeat`.
    cloned.wrapS = cloned.wrapT = THREE.ClampToEdgeWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture, geometry, sampler.filter]);
  useEffect(() => () => preparedTexture?.dispose(), [preparedTexture]);

  const clippingPlanes = useControlClipPlanes();
  const decodeDefines = useCanvasDecodeDefines(preparedTexture);

  if (!geometry || !preparedTexture) return null;

  const program = materialProgramInputs({
    props: {
      map: preparedTexture,
      color: tint.color,
      opacity: tint.opacity,
      transparent: true,
      depthWrite: false,
      defines: decodeDefines,
      clippingPlanes: clippingPlanes as THREE.Plane[],
    },
    merge: [canvasItemFacing()],
  });

  return (
    <group scale={[1, -1, 1]} renderOrder={renderOrder}>
      <mesh renderOrder={renderOrder}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </group>
  );
}
