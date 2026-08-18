/**
 * <Sprite3D> — billboarded 2D texture rendered in 3D space.
 *
 * Architecture:
 *   - Texture state machine: `useTexture2D`, which covers an image
 *     file, an inline procedural texture and a CanvasTexture alike.
 *     Pending → render nothing (lets the scene continue);
 *     missing/error → magenta placeholder mesh + drei `<Text>` label
 *     naming the path (matches MeshInstance3D UX).
 *   - Quad geometry: `<planeGeometry>` sized by `pixel_size` × the
 *     active texture region (full image, sprite-sheet tile, or
 *     `region_rect` sub-image). Same pattern as Label3D's textured
 *     plane, but the texture comes from the host file provider rather
 *     than a runtime canvas rasteriser.
 *   - UV math: region_rect + hframes/vframes composition lives in the
 *     shared `r3f/spriteFrame` module (one home for Sprite2D +
 *     Sprite3D). flip_h/flip_v stay here — 3D mirrors via UV negation
 *     where 2D mirrors via mesh scale — as does the wrap mode, which
 *     Sprite3D derives per frame (`spriteWrapMode`) where the 2D
 *     canvas always clamps.
 *
 * Material:
 *   - `meshBasicMaterial`, or `meshStandardMaterial` when `shaded`
 *     (`material.cpp:3045`: SHADING_MODE_UNSHADED vs SHADING_MODE_PER_PIXEL)
 *   - `color`     ← modulate RGB
 *   - `opacity`   ← clamp01(modulate.a * (1 - transparency)),
 *                   `transparent` flag follows
 *   - `alphaTest` ← `alpha_scissor_threshold` when alpha_cut === DISCARD,
 *                   `alphaHash` when === HASH — see `alphaCutBehaviour`
 *   - `depthWrite`← false only on the plain blended path
 *   - `side`      ← DoubleSide (sprite quads should be visible from
 *                   the back too — Godot's runtime behaviour)
 *   - `renderOrder` on the mesh ← render_priority
 *
 * Billboard handling is deferred to a runtime per-frame look-at via
 * `mesh.userData.billboardMode` (the same convention Label3D uses).
 * Wiring the runtime billboarding loop is a separate concern; this
 * component just persists the mode and axis so the consumer can act.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { composeFrameTexture, frameSizePx, spriteWrapMode } from '../../../r3f/spriteFrame';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useTexture2D } from '../../../resources/useTexture2D';
import {
  applyTextureFilterState,
  godotTextureFilterState,
} from '../../../resources/textures/godotTextureFilter';
import {
  AlphaCutMode,
  type Sprite3DProperties,
} from './types';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useBillboard } from '../../../r3f/hooks/useBillboard';

/** Stand-in for the prepass cut, which Godot takes from the SCENE, not the node. */
const PREPASS_ALPHA_TEST = 0.5;

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

  // `texture` may be an image file, or a procedural texture described entirely
  // inside the scene; `useTexture2D` resolves either and reports a reference it
  // cannot resolve as `missing`.
  const { texture: sourceTexture, missing: textureMissing } = useTexture2D(
    properties.texture,
    externalResources,
    internalResources
  );

  // Compose the visible texture (shared spriteFrame module clones + windows
  // the UVs to the region/frame), then mirror via UV negation: flip the
  // (already cropped) UV window by negating the repeat and shifting the
  // offset to the opposite edge.
  const displayedTexture = useMemo(() => {
    // The wrap mode is DERIVED, not fixed: `sprite_3d.cpp:163` reads it off the
    // frame's own UV corners, so only an overrunning window tiles.
    // SRGBColorSpace: Sprite3D draws through Godot's 3D pipeline (always a
    // hardware sRGB decode before filtering, `canvas2DTextureDecode.ts`), so
    // it keeps the shared cache entry's own colour space rather than the 2D
    // canvas's `NoColorSpace` retag.
    const wrap = spriteWrapMode(sourceTexture ?? undefined, properties);
    const cloned = composeFrameTexture(sourceTexture ?? undefined, properties, wrap, THREE.SRGBColorSpace);
    if (!cloned) return undefined;
    // Sprite3D's texture is a node property, not a material slot, so the node's
    // own `texture_filter` (`material.cpp:3055`) lands on this clone.
    applyTextureFilterState(cloned, godotTextureFilterState(properties.texture_filter));
    if (properties.flip_h) {
      cloned.offset.x += cloned.repeat.x;
      cloned.repeat.x = -cloned.repeat.x;
    }
    if (properties.flip_v) {
      cloned.offset.y += cloned.repeat.y;
      cloned.repeat.y = -cloned.repeat.y;
    }
    return cloned;
  }, [sourceTexture, properties]);

  // Quad sizing: pixel_size × the frame's pixel dimensions (1×1 fallback
  // before the image loads keeps the placeholder at expected scale).
  const { width, height } = useMemo(() => {
    const px = frameSizePx(sourceTexture ?? undefined, properties);
    return { width: px.width * properties.pixel_size, height: px.height * properties.pixel_size };
  }, [sourceTexture, properties]);

  // Modulate RGB and effective opacity. Transparency property is
  // additive: opacity = modulate.a * (1 - transparency). Godot stores modulate
  // in sRGB → convert to the linear working space before the unlit material
  // (matching Sprite2D / WorldEnvironment).
  const color = useGodotLinearColor(properties.modulate);
  const opacity = clamp01(properties.modulate.a * (1 - properties.transparency));

  const cut = alphaCutBehaviour(properties);
  // A prepass arm blends whatever the modulate says; plain ALPHA blends only
  // where it must, and the two cutting arms output opaque.
  const transparent =
    cut.blended &&
    (opacity < 1 || properties.alpha_cut === AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS);
  const alphaTest = cut.alphaTest;
  // An opaque sprite must write depth so it occludes and sorts correctly
  // against other opaque geometry; only the blended paths may skip depthWrite.
  const depthWrite = transparent ? cut.depthWrite : true;

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

  // No texture referenced at all: render a stub placeholder so users
  // see that the sprite node exists in the scene even without a texture.
  // (Linter would already flag this as `sprite3d-requires-texture`.)
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

  // Texture failed to load: magenta-quad placeholder. The in-3D path
  // label was moved to the DOM `<MissingResourcesPanel>`.
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

  // Pending: render nothing visible yet. Wait for the texture to arrive
  // (which `useTexture2D` will pick up automatically on the next render
  // cycle once the host provides the file).
  if (!displayedTexture) {
    return (
      <>
        <group
          ref={spriteRef}
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

  const program = materialProgramInputs({
    props: {
      map: displayedTexture,
      color,
      opacity,
      transparent,
      alphaTest,
      alphaHash: cut.alphaHash,
      depthWrite,
      // FLAG_DISABLE_DEPTH_TEST → `render_mode depth_test_disabled` (`material.cpp:863`).
      depthTest: !properties.no_depth_test,
      side: properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide,
    },
    merge: [properties.shaded ? SHADED_SCALARS : undefined],
  });

  return (
    <>
      <mesh
        ref={spriteRef}
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        renderOrder={properties.render_priority}
        userData={{ billboardMode: properties.billboard, billboardAxis: properties.axis }}
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

interface AlphaCutBehaviour {
  alphaTest: number;
  alphaHash: boolean;
  depthWrite: boolean;
  /** Whether the arm reaches the blended pass at all. */
  blended: boolean;
}

/**
 * Godot's `mat_transparency` switch (`sprite_3d.cpp:285-297`) in three's terms.
 * ALPHA_SCISSOR and ALPHA_HASH force `alpha = 1.0` past the cut
 * (`scene_forward_clustered.glsl:1414-1416`) and so land in the opaque pass
 * (`scene_shader_forward_clustered.cpp:252`); ALPHA_DEPTH_PRE_PASS keeps
 * blending and cuts only in the depth pass, against the scene's own
 * `opaque_prepass_threshold` (`render_forward_clustered.cpp:1791`).
 */
function alphaCutBehaviour(props: Sprite3DProperties): AlphaCutBehaviour {
  // FLAG_TRANSPARENT off disables the whole switch (`sprite_3d.cpp:286`).
  if (props.transparent === false)
    return { alphaTest: 0, alphaHash: false, depthWrite: true, blended: false };
  switch (props.alpha_cut) {
    case AlphaCutMode.ALPHA_CUT_DISCARD:
      // `sprite_3d.cpp:281` hands the node's own threshold to the material.
      return {
        alphaTest: props.alpha_scissor_threshold,
        alphaHash: false,
        depthWrite: true,
        blended: false,
      };
    case AlphaCutMode.ALPHA_CUT_HASH:
      return { alphaTest: 0, alphaHash: true, depthWrite: true, blended: false };
    case AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS:
      return { alphaTest: PREPASS_ALPHA_TEST, alphaHash: false, depthWrite: true, blended: true };
    case AlphaCutMode.ALPHA_CUT_DISABLED:
    default:
      return { alphaTest: 0, alphaHash: false, depthWrite: false, blended: true };
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
