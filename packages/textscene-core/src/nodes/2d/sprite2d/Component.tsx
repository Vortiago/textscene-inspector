/**
 * <Sprite2D> — a textured quad in 2D space. A CanvasItem2D (which carries the
 * 2D transform + modulate ritual) whose body is a `planeGeometry` sized to the
 * texture's pixel dimensions (1 px = 1 world unit). Inside the conjugated
 * (diag(1,-1,1)) Node2D group, a Godot-local point p is placed at three-local
 * (p.x, -p.y), so the quad centre is computed in Godot 2D space (+Y down) then
 * Y-negated.
 *
 * Surface handled: texture (an image file, an inline procedural texture, or a
 * SubViewport's own target — `useTexture2D` and `useViewportTextureSlot`
 * between them cover the three), centered/offset, flip_h/flip_v
 * (mirror via mesh scale, which flips the texture too — matching Godot),
 * region_rect, hframes/vframes/frame/frame_coords sprite-sheet slicing, and the
 * CanvasItem `modulate` tint. Material is unlit (meshBasicMaterial) like Godot's
 * 2D canvas, double-sided, alpha-blended. Missing/pending texture mirrors the
 * Sprite3D UX (placeholder plane / render nothing yet).
 *
 * The region/frames UV + size math lives in the shared `r3f/spriteFrame` module
 * (one home for Sprite2D + Sprite3D). Flip handling stays here because it
 * legitimately differs: 2D mirrors via mesh scale, 3D via UV negation. So does
 * the wrap mode: the 2D canvas clamps a region that overruns its texture where
 * Sprite3D tiles it.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { canvasItemBlendState, type CanvasItemBlendState } from '../../../resources/materials/canvasitemmaterial/renderer';
import type { CanvasItemLightingProps } from '../../../r3f/lighting2d/useCanvasItemLighting';
import { CanvasItemBlendMode } from '../../../resources/materials/canvasitemmaterial/types';
import { composeFrameTexture, frameSizePx } from '../../../r3f/spriteFrame';
import { useCanvasDecodeDefines } from '../../../r3f/canvas2DTextureDecode';
import { canvasItemFacing } from '../../../r3f/canvasItemFacing';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import {
  isViewportTextureRef,
  useViewportTextureSlot,
} from '../../../resources/textures/viewporttexture/useViewportTextureSlot';
import { useTexture2D } from '../../../resources/useTexture2D';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { Sprite2DProperties } from './types';

export function Sprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Sprite2DProperties;
  const { externalResources, internalResources } = useSceneResources();

  // An active AnimationPlayer can drive this sprite's sheet `frame` (ADR-0016);
  // `null` means none is, so the authored `frame` shows. The registry carries a
  // numeric tuple (ADR-0017) — `frame` is a 1-tuple.
  const animatedFrame = useAnimatedValue('frame', (v) => v[0] ?? null);

  // `texture = SubResource(ViewportTexture)` names a `<SubViewport>` rather
  // than a file — the live target a sub-viewport published, which is the whole
  // of Godot's "3D in 2D" demo. It bypasses the loader AND the frame compositor
  // below: a viewport target owns its GPU texture, so cloning per frame and
  // disposing the clone would tear down the publisher's own render target.
  const isViewportSlot = isViewportTextureRef(props.texture, internalResources);
  const { texture: viewportTexture, cyclic: viewportCyclic } = useViewportTextureSlot(
    props.texture,
    internalResources
  );

  // `useTexture2D`, not the path-only resolver: `texture` may name an inline
  // procedural texture (a GradientTexture2D), which has no path to resolve to
  // and rasterises straight out of the scene.
  const { texture: sourceTexture, missing: textureMissing } = useTexture2D(
    isViewportSlot ? undefined : props.texture,
    externalResources,
    internalResources
  );

  // A driven `frame` overrides the authored `frame` AND any authored
  // `frame_coords` (in Godot the two are the same value), so the animation wins.
  const composedTexture = useMemo(() => {
    const frameProps =
      animatedFrame !== null ? { ...props, frame: animatedFrame, frame_coords: undefined } : props;
    // 'clamp': the 2D canvas samples with texture-repeat DISABLED, so a
    // region_rect overrunning the texture stretches its edge texels rather
    // than tiling. NoColorSpace: the 2D canvas's hardware filter blends
    // undecoded sRGB bytes (`canvas2DTextureDecode.ts`); QuadMesh's material
    // decodes the already-filtered sample via `useCanvasDecodeDefines`.
    return composeFrameTexture(sourceTexture ?? undefined, frameProps, 'clamp', THREE.NoColorSpace);
  }, [sourceTexture, props, animatedFrame]);
  // composeFrameTexture clones the texture per frame; dispose the prior clone
  // when the frame advances (and on unmount) so playback doesn't leak GPU
  // textures (~one per keyframe otherwise).
  useEffect(() => () => composedTexture?.dispose(), [composedTexture]);

  const displayedTexture = viewportTexture ?? composedTexture;
  // A ViewportTexture keeps its publisher's own colour space (never this
  // module's NoColorSpace retag), so this resolves to `undefined` for it —
  // exactly as it should, since it isn't part of the retag this pairs with.
  const decodeDefines = useCanvasDecodeDefines(displayedTexture);
  // Quad size in pixels (1 px = 1 world unit in the 2D canvas). A render
  // target reports its rect through the same `image` shape a loaded texture
  // uses, so the sizing path is shared.
  const { width, height } = useMemo(
    () => frameSizePx(viewportTexture ?? sourceTexture ?? undefined, props),
    [viewportTexture, sourceTexture, props]
  );

  // Placeholder when no texture is referenced or it failed to load. A
  // ViewportTexture that has not published yet is NOT missing — the sub-viewport
  // is there and simply has not rendered, so the sprite draws nothing until it
  // does rather than flashing a placeholder. A ViewportTexture whose target
  // sits in an unrenderable pass cycle (`useViewportTextureSlot`'s `cyclic`)
  // IS missing in the same visible sense a broken file reference is — it will
  // never render — so it gets the same placeholder, not permanent silence.
  const showPlaceholder = isViewportSlot
    ? viewportCyclic
    : !props.texture || textureMissing;

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }, material, lighting) =>
        showPlaceholder ? (
          <MissingResourcePlaceholder shape="plane" name={node.name} />
        ) : displayedTexture ? (
          <QuadMesh
            texture={displayedTexture}
            color={color}
            opacity={opacity}
            width={width}
            height={height}
            props={props}
            blend={canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
            lighting={lighting}
            decodeDefines={decodeDefines}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

function QuadMesh({
  texture,
  color,
  opacity,
  width,
  height,
  props,
  blend,
  lighting,
  decodeDefines,
}: {
  texture: THREE.Texture;
  color: THREE.Color;
  opacity: number;
  width: number;
  height: number;
  props: Sprite2DProperties;
  blend: CanvasItemBlendState;
  lighting: CanvasItemLightingProps;
  decodeDefines: Record<string, string> | undefined;
}) {
  // Quad centre in Godot 2D space (+Y down), then Y-negated for the conjugated
  // group frame. centered ⇒ centre at `offset`; otherwise the quad's top-left
  // sits at `offset`, so its centre is offset + (w/2, h/2).
  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

  // The quad waits for a texture, so the map is here at the first compile — but
  // the DECODE is not fixed for the quad's life: a ViewportTexture keeps its own
  // colour space where a `res://` file gets the canvas retag, and swapping
  // between them changes the program (`materialProgramInputs.ts`).
  const program = materialProgramInputs({
    props: {
      map: texture,
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      defines: decodeDefines,
    },
    merge: [canvasItemFacing(), blend, lighting],
  });

  return (
    <mesh position={[cgx, -cgy, 0]} scale={meshScale}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

