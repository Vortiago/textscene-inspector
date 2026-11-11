/**
 * <Sprite3D>: a 2D texture drawn as a quad in 3D space, sized by `pixel_size` × the active region
 * (full image, sheet tile or `region_rect`). `useTexture2D` resolves the texture, whatever its
 * source. `meshStandardMaterial` when `shaded`, else
 * `meshBasicMaterial` (`material.cpp:3045`: SHADING_MODE_PER_PIXEL versus SHADING_MODE_UNSHADED).
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { node3dGroupSpread, transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { frameRectPx, frameUvWindow, spriteWrapMode } from '../../../r3f/spriteFrame';
import { WRAP } from '../../../r3f/canvasItemTextureSampler';
import { useTextureView } from '../../../r3f/useTextureView';
import { flippedUvWindow, regionUvWindow } from '../../../r3f/uvWindow';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnisotropicFilteringLevel } from '../../../r3f/contexts/AnisotropicFilteringContext';
import { viewportProgramInputs } from '../../../r3f/materialProgramInputs';
import { materialFor2d } from '../../../r3f/materialFor2d';
import type { FadePass } from '../../../r3f/materials/fadeVariants';
import { passBlendMaterialProps } from '../../../r3f/materials/surfaceBlend';
import type { MaterialAttach } from '../../../r3f/materials/swappedMaterials';
import { FadedMaterials } from '../../../r3f/materials/FadedMaterials';
import { useSpriteBase3DColorAccum } from '../../../r3f/spriteBase3DColorAccum';
import { useTexture2D } from '../../../resources/useTexture2D';
import { sourceColorSpace } from '../../../resources/textures/sourceColorSpace';
import type { Sprite3DProperties } from './types';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useOwnMaterialPose } from '../../../r3f/hooks/useOwnMaterialPose';
import { FramePoint } from '../../../r3f/components/NodeAabb';
import { useGeometryInstance, useInstanceDraw } from '../../../r3f/visibilityRange/geometryInstance';
import { InstancePasses } from '../../../r3f/materials/InstancePasses';
import { authoredPlacement, UNPLACED } from '../../../r3f/visibilityRange/placements';
import {
  spriteQuadAabb,
  spriteQuadGeometry,
  spriteQuadPart,
  spriteQuadRect,
  writeSpriteQuadColour,
  writeSpriteQuadUvs,
} from './quad';
import { clamp } from '../../../godot/math/math';
import { rect2Intersection } from '../../../godot/math/rect2';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';

export function Sprite3D({ node, children }: NodeComponentProps) {
  const spriteRef = useRef<THREE.Object3D | null>(null);
  const properties = node.properties as Sprite3DProperties;
  const { externalResources, internalResources } = useSceneResources();

  const transform = useMemo(() => transformFromNode3DProperties(properties), [properties]);

  const { override, shadow } = useInstanceDraw();
  const posedRef = useOwnMaterialPose(spriteRef, properties, transform.scale);

  // The sprite's material samples `texture_albedo` as `source_color` (`material.cpp:969`), so a
  // ViewportTexture gives its decoding view.
  const {
    texture: sourceTexture,
    size: reportedSize,
    missing: textureMissing,
    atlasCell,
  } = useTexture2D(properties.texture, externalResources, internalResources, 'decoding');

  // An AtlasTexture draws its region alone, so a margin is no part of the quad
  // (`atlas_texture.cpp:193-219`). Any other texture draws the whole frame.
  const { frame, drawn } = useMemo(() => {
    const frame = frameRectPx(reportedSize, properties);
    return { frame, drawn: atlasCell ? rect2Intersection(frame, atlasCell.region) : frame };
  }, [reportedSize, properties, atlasCell]);
  // `sprite_3d.cpp:104`.
  const drawsNothing = drawn.w === 0 || drawn.h === 0;
  // An AtlasTexture samples its atlas, with the UVs of the atlas (`sprite_3d.cpp:136-150`).
  const sampledTexture = atlasCell?.sheet ?? sourceTexture;
  const drawnWindow = useMemo(() => {
    if (!atlasCell) return frameUvWindow(sourceTexture ?? undefined, properties);
    const { cell, sheetSize } = atlasCell;
    return regionUvWindow(
      { ...drawn, x: cell.x + drawn.x, y: cell.y + drawn.y },
      { x: sheetSize.width, y: sheetSize.height }
    );
  }, [sourceTexture, properties, atlasCell, drawn]);

  // The wrap mode is derived, not fixed: `sprite_3d.cpp:163` reads it off the quad's own UV
  // corners, so only an overrunning window tiles.
  const wrap = spriteWrapMode(drawnWindow);
  const anisotropicFilteringLevel = useAnisotropicFilteringLevel();
  const { blends, joinsShadowPass, shading, side, depthTest, textureFilter } = materialFor2d({
    alphaCut: properties.alpha_cut,
    alphaScissorThreshold: properties.alpha_scissor_threshold,
    // `sprite_3d.cpp:286`: FLAG_TRANSPARENT off disables the whole switch.
    transparentFlag: properties.transparent,
    alphaHashScale: properties.alpha_hash_scale,
    alphaAntialiasingMode: properties.alpha_antialiasing_mode,
    alphaAntialiasingEdge: properties.alpha_antialiasing_edge,
    // DoubleSide by default: Godot's runtime shows a sprite quad from behind too.
    doubleSided: properties.double_sided,
    noDepthTest: properties.no_depth_test,
    shaded: properties.shaded,
    textureFilter: properties.texture_filter,
    anisotropicFilteringLevel,
  });
  // `texture_albedo` is a `source_color` sampler (`sprite_3d.cpp:306`), so the view reads as an
  // albedo, and the node's own `texture_filter` lands on it (`material.cpp:3055`).
  const displayedTexture = useTextureView(
    sampledTexture,
    sampledTexture && {
      colorSpace: sourceColorSpace(sampledTexture),
      filter: textureFilter,
      wrap: WRAP[wrap],
    }
  );
  // Flip mirrors through the UV window, where 2D mirrors through mesh scale.
  const frameWindow = useMemo(
    () => flippedUvWindow(drawnWindow, properties.flip_h === true, properties.flip_v === true),
    [drawnWindow, properties.flip_h, properties.flip_v]
  );

  // Quad sizing: pixel_size × the frame's pixel dimensions (1×1 fallback
  // before the image loads keeps the placeholder at expected scale).
  const rect = useMemo(() => {
    const size = { width: frame.w * properties.pixel_size, height: frame.h * properties.pixel_size };
    return spriteQuadPart(spriteQuadRect(size, properties), frame, drawn, properties.pixel_size);
  }, [frame, drawn, properties]);
  // The frame decides the box, so a texture still loading leaves the sprite unplaced.
  const placement = useMemo(
    () =>
      sourceTexture
        ? authoredPlacement(
            spriteRef,
            properties.transform,
            spriteQuadAabb(rect, properties.axis, properties.billboard)
          )
        : UNPLACED,
    [sourceTexture, rect, properties.transform, properties.axis, properties.billboard]
  );
  useGeometryInstance(placement);

  // `_get_color_accum()` (`sprite_3d.cpp:36-52`) folds the parent sprite's accumulation into this
  // node's modulate, r/g/b and a. Godot multiplies the stored colours and converts once, so the
  // sRGB→linear step stays here, after the product (matching Sprite2D and WorldEnvironment).
  const accum = useSpriteBase3DColorAccum(properties.modulate);
  const color = useGodotLinearColor(accum);
  // The instance fade is per GeometryInstance3D, outside the accumulation: only `modulate`
  // accumulates. It can move the quad to the alpha pass, which no cut arm reaches.
  // TRANSPARENCY_DISABLED never multiplies the modulate alpha into ALPHA (`material.cpp:1836`).
  const opacity = properties.transparent ? clamp(accum.a, 0, 1) : 1;
  // The material that draws decides the shadow pass: an override's own draw hooks answer for it.
  const castsShadow = shadow.castShadow && (joinsShadowPass || override !== undefined);

  // Baked into the geometry, so it stays right under the node's rotation and billboard.
  const geometry = useMemo(() => spriteQuadGeometry(rect, properties.axis), [rect, properties.axis]);
  // `geometry` goes through `<primitive>`, which R3F does not auto-dispose, so this releases the
  // GPU buffers on replacement and unmount.
  useDisposeOnRelease(geometry);
  // Layout, not passive: the quad holds its frame and colour before the frame that first draws it.
  useLayoutEffect(() => writeSpriteQuadUvs(geometry, frameWindow), [geometry, frameWindow]);
  useLayoutEffect(() => writeSpriteQuadColour(geometry, accum), [geometry, accum]);

  // Descendants ride in a sibling group with the same transform, not inside the quad: in Godot
  // `billboard` is a shader-side effect that never spins the node's children. Every branch below
  // renders it, placeholder and pending included, so a missing or slow texture keeps the subtree.
  const subtree = children === undefined ? null : <group {...node3dGroupSpread(transform)}>{children}</group>;

  // Texture failed to load: a magenta-quad placeholder. The DOM `<MissingResourcesPanel>` names the
  // path.
  if (textureMissing) {
    return (
      <>
        <MissingResourcePlaceholder
          shape="plane"
          name={node.name}
          position={transform.position}
          rotation={transform.rotation}
          scale={transform.scale}
        />
        {subtree}
      </>
    );
  }

  // No texture draws nothing (`sprite_3d.cpp:798`), and so does one still pending: `useTexture2D`
  // picks it up on a later render, once the host provides the file.
  if (!displayedTexture || drawsNothing) {
    return (
      <>
        <group ref={spriteRef} name={node.name} {...node3dGroupSpread(transform)}>
          <FramePoint />
        </group>
        {subtree}
      </>
    );
  }

  const material = (pass: FadePass, attach: string | MaterialAttach | undefined) => {
    const blend = blends[pass];
    const program = viewportProgramInputs({
      props: {
        attach,
        map: displayedTexture,
        color,
        opacity,
        ...passBlendMaterialProps(blend),
        injection: blend.injection,
        // FLAG_DISABLE_DEPTH_TEST → `render_mode depth_test_disabled` (`material.cpp:863`).
        depthTest,
        side,
      },
      merge: [shading],
    });
    return shading ? (
      <meshStandardMaterial key={program.key} {...program.props} />
    ) : (
      <meshBasicMaterial key={program.key} {...program.props} />
    );
  };

  return (
    <>
      <mesh
        // The billboard and `fixed_size` hooks pose the quad. The subtree is a sibling, so the
        // cull skipping the quad's draws skips nothing else.
        ref={spriteRef}
        name={node.name}
        {...node3dGroupSpread(transform)}
        // `render_priority` is the sprite material's (`sprite_3d.cpp:311`).
        renderOrder={override ? 0 : properties.render_priority}
        castShadow={castsShadow}
        receiveShadow
        onBeforeRender={shadow.onBeforeRender}
        onAfterRender={shadow.onAfterRender}
        onBeforeShadow={shadow.onBeforeShadow}
        onAfterShadow={shadow.onAfterShadow}
        userData={visualLayersUserData(properties.layers)}
      >
        <primitive object={geometry} attach="geometry" />
        <InstancePasses
          meshRef={spriteRef}
          posedRef={posedRef}
          ownMaterial={<FadedMaterials>{material}</FadedMaterials>}
        />
      </mesh>
      {subtree}
    </>
  );
}
