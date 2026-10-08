/**
 * <Sprite3D>: a 2D texture drawn as a quad in 3D space, sized by `pixel_size` × the active region
 * (full image, sheet tile or `region_rect`). `useTexture2D` resolves an image file, an inline
 * procedural texture or a CanvasTexture. `meshStandardMaterial` when `shaded`, else
 * `meshBasicMaterial` (`material.cpp:3045`: SHADING_MODE_PER_PIXEL versus SHADING_MODE_UNSHADED).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { frameSizePx, frameUvWindow, spriteSamplerClone, spriteWrapMode } from '../../../r3f/spriteFrame';
import { useUploadedClone } from '../../../r3f/tiledUpload/useTiledUpload';
import { useUvWindow } from '../../../r3f/useUvWindow';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { alphaCutSurface } from '../../../r3f/godotAlphaCut';
import { cutSurfaceAlpha } from '../../../r3f/materials/fadedSurfaceAlpha';
import { useSpriteBase3DColorAccum } from '../../../r3f/spriteBase3DColorAccum';
import { useTexture2D } from '../../../resources/useTexture2D';
import {
  applyTextureFilterState,
  godotTextureFilterState,
} from '../../../resources/textures/godotTextureFilter';
import type { Sprite3DProperties } from './types';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { useFixedSize } from '../../../r3f/hooks/useFixedSize';
import { useGeometryInstance } from '../../../r3f/visibilityRange/useGeometryInstance';
import { authoredPlacement } from '../../../r3f/visibilityRange/placements';
import { spriteQuadAabb, spriteQuadGeometry, spriteQuadRect } from './quad';

/** The sprite material's own PBR uniforms (`sprite_3d.cpp:721-722`). */
const SHADED_SCALARS = { metalness: 0, roughness: 1 } as const;

export function Sprite3D({ node, children }: NodeComponentProps) {
  // Godot's billboard is a material-side effect on the sprite quad; the shared
  // hook applies the same modes Label3D uses.
  const spriteRef = useRef<THREE.Object3D | null>(null);
  const properties = node.properties as Sprite3DProperties;
  useBillboard(spriteRef, properties.billboard);
  const { externalResources, internalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // `sprite_3d.cpp:299` hands the flag to the same cached shader the billboard
  // mode does; both are per-frame effects on the sprite quad itself.
  useFixedSize(spriteRef, properties.fixed_size, scale);

  // `texture` may be an image file, or a procedural texture described entirely
  // inside the scene; `useTexture2D` resolves either and reports a reference it
  // cannot resolve as `missing`.
  const { texture: sourceTexture, missing: textureMissing } = useTexture2D(
    properties.texture,
    externalResources,
    internalResources
  );

  // The wrap mode is derived, not fixed: `sprite_3d.cpp:163` reads it off the frame's own UV
  // corners, so only an overrunning window tiles.
  const wrap = spriteWrapMode(sourceTexture ?? undefined, properties);
  const textureFilter = properties.texture_filter;
  // The shared `r3f/spriteFrame` module (Sprite2D and Sprite3D) clones the texture with its
  // sampler state. SRGBColorSpace: Godot's 3D pipeline decodes sRGB in hardware before filtering
  // (`canvas2DTextureDecode.ts`), so the clone keeps the cache entry's colour space, not the 2D
  // canvas's `NoColorSpace` retag.
  const samplerClone = useMemo(() => {
    const cloned = spriteSamplerClone(sourceTexture ?? undefined, wrap, THREE.SRGBColorSpace);
    // Sprite3D's texture is a node property, not a material slot, so the node's
    // own `texture_filter` (`material.cpp:3055`) lands on this clone.
    if (cloned) applyTextureFilterState(cloned, godotTextureFilterState(textureFilter));
    return cloned;
  }, [sourceTexture, wrap, textureFilter]);
  // The clone is this component's, never the loader's cached entry: `useUploadedClone`
  // uploads it once and disposes it once it no longer draws. A frame change keeps it.
  const displayedTexture = useUploadedClone(samplerClone ?? null);
  // Flip mirrors through UV negation, where 2D mirrors through mesh scale: negate the
  // repeat and shift the offset to the opposite edge.
  const frameWindow = useMemo(() => {
    const uv = frameUvWindow(sourceTexture ?? undefined, properties);
    if (properties.flip_h) {
      uv.offset.x += uv.repeat.x;
      uv.repeat.x = -uv.repeat.x;
    }
    if (properties.flip_v) {
      uv.offset.y += uv.repeat.y;
      uv.repeat.y = -uv.repeat.y;
    }
    return uv;
  }, [sourceTexture, properties]);
  useUvWindow(displayedTexture, frameWindow);

  // Quad sizing: pixel_size × the frame's pixel dimensions (1×1 fallback
  // before the image loads keeps the placeholder at expected scale).
  const rect = useMemo(() => {
    const px = frameSizePx(sourceTexture ?? undefined, properties);
    const size = { width: px.width * properties.pixel_size, height: px.height * properties.pixel_size };
    return spriteQuadRect(size, properties);
  }, [sourceTexture, properties]);
  const placement = useMemo(
    () =>
      authoredPlacement(
        spriteRef,
        properties.transform,
        spriteQuadAabb(rect, properties.axis, properties.billboard)
      ),
    [rect, properties.transform, properties.axis, properties.billboard]
  );
  const { fade, hideWhenCulled } = useGeometryInstance(properties, placement);
  // The quad's ref: the billboard and `fixed_size` hooks pose it, and the cull hides it.
  const quadRef = useCallback(
    (quad: THREE.Mesh | null) => {
      spriteRef.current = quad;
      hideWhenCulled(quad);
    },
    [hideWhenCulled]
  );

  // `_get_color_accum()` (`sprite_3d.cpp:36-52`) folds the parent sprite's accumulation into this
  // node's modulate, r/g/b and a. Godot multiplies the stored colours and converts once, so the
  // sRGB→linear step stays here, after the product (matching Sprite2D and WorldEnvironment).
  const accum = useSpriteBase3DColorAccum(properties.modulate);
  const color = useGodotLinearColor(accum);
  const cut = alphaCutSurface({
    mode: properties.alpha_cut,
    scissorThreshold: properties.alpha_scissor_threshold,
    // `sprite_3d.cpp:286`: FLAG_TRANSPARENT off disables the whole switch.
    transparentFlag: properties.transparent,
  });
  // The instance fade is per GeometryInstance3D, outside the accumulation: only `modulate`
  // accumulates. It can move the quad to the alpha pass, which no cut arm reaches.
  // TRANSPARENCY_DISABLED never multiplies the modulate alpha into ALPHA (`material.cpp:1836`).
  const surfaceAlpha = cutSurfaceAlpha(cut, properties.transparent ? clamp01(accum.a) : 1, fade);

  // Baked into the geometry, so it stays right under the node's rotation and billboard.
  const geometry = useMemo(() => spriteQuadGeometry(rect, properties.axis), [rect, properties.axis]);
  // `geometry` goes through `<primitive>`, which R3F does not auto-dispose, so this releases the
  // GPU buffers on replacement and unmount.
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Descendants ride in a sibling group with the same transform, not inside the quad: in Godot
  // `billboard` is a shader-side effect that never spins the node's children. Every branch below
  // renders it, placeholder and pending included, so a missing or slow texture keeps the subtree.
  const subtree =
    children === undefined ? null : (
      <group position={position} rotation={rotation} scale={scale}>
        {children}
      </group>
    );

  // No texture referenced: a stub placeholder shows the sprite node exists. The linter flags this
  // as `sprite3d-requires-texture`.
  if (!properties.texture) {
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

  // Texture failed to load: a magenta-quad placeholder. The DOM `<MissingResourcesPanel>` names the
  // path.
  if (textureMissing) {
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

  // Pending: nothing visible until `useTexture2D` picks the texture up on a later render, once the
  // host provides the file.
  if (!displayedTexture) {
    return (
      <>
        <group ref={spriteRef} name={node.name} position={position} rotation={rotation} scale={scale} />
        {subtree}
      </>
    );
  }

  const program = materialProgramInputs({
    props: {
      map: displayedTexture,
      color,
      ...surfaceAlpha,
      // FLAG_DISABLE_DEPTH_TEST → `render_mode depth_test_disabled` (`material.cpp:863`).
      depthTest: !properties.no_depth_test,
      // DoubleSide by default: Godot's runtime shows a sprite quad from behind too.
      side: properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide,
    },
    merge: [properties.shaded ? SHADED_SCALARS : undefined],
  });

  return (
    <>
      <mesh
        // The subtree is a sibling, so the cull hiding the quad hides nothing else.
        ref={quadRef}
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        renderOrder={properties.render_priority}
      >
        <primitive object={geometry} attach="geometry" />
        {properties.shaded ? (
          <meshStandardMaterial key={program.key} {...program.props} />
        ) : (
          <meshBasicMaterial key={program.key} {...program.props} />
        )}
      </mesh>
      {subtree}
    </>
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
