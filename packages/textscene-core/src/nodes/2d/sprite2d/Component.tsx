/**
 * Draws a Sprite2D: a CanvasItem2D whose body is a quad sized to the texture's
 * pixels (1 px = 1 world unit). The region and frame math is shared with Sprite3D
 * in `r3f/spriteFrame`. Flipping stays here: 2D mirrors by mesh scale, which
 * flips the texture too, as in Godot, where 3D negates the UV.
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

  // An active AnimationPlayer can drive the sheet `frame` (ADR-0016), and `null`
  // means none does. The registry carries a numeric tuple (ADR-0017), here a 1-tuple.
  const animatedFrame = useAnimatedValue('frame', (v) => v[0] ?? null);

  // `texture = SubResource(ViewportTexture)` names a `<SubViewport>`'s live
  // target. It bypasses the loader and the frame compositor: the target owns its
  // GPU texture, so disposing a per-frame clone would tear down the publisher's
  // render target.
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

  // A driven `frame` overrides the authored `frame` and any authored
  // `frame_coords` (in Godot the two are the same value), so the animation wins.
  const composedTexture = useMemo(() => {
    const frameProps =
      animatedFrame !== null ? { ...props, frame: animatedFrame, frame_coords: undefined } : props;
    // 'clamp': the 2D canvas disables texture-repeat, so an overrunning
    // region_rect stretches its edge texels, where Sprite3D tiles. NoColorSpace:
    // the canvas filter blends undecoded sRGB bytes (`canvas2DTextureDecode.ts`),
    // and QuadMesh decodes the filtered sample through `useCanvasDecodeDefines`.
    return composeFrameTexture(sourceTexture ?? undefined, frameProps, 'clamp', THREE.NoColorSpace);
  }, [sourceTexture, props, animatedFrame]);
  // composeFrameTexture clones the texture per frame, so dispose the prior clone
  // when the frame advances and on unmount, or playback leaks one per keyframe.
  useEffect(() => () => composedTexture?.dispose(), [composedTexture]);

  const displayedTexture = viewportTexture ?? composedTexture;
  // A ViewportTexture keeps its publisher's colour space, not the NoColorSpace
  // retag, so this resolves to `undefined` for it.
  const decodeDefines = useCanvasDecodeDefines(displayedTexture);
  // Quad size in pixels (1 px = 1 world unit in the 2D canvas). A render
  // target reports its rect through the same `image` shape a loaded texture
  // uses, so the sizing path is shared.
  const { width, height } = useMemo(
    () => frameSizePx(viewportTexture ?? sourceTexture ?? undefined, props),
    [viewportTexture, sourceTexture, props]
  );

  // A placeholder for no texture or a failed load. An unpublished ViewportTexture
  // is not missing, so the sprite draws nothing until it renders. One in an
  // unrenderable pass cycle (`cyclic`) never will, so it gets the placeholder.
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
  // Quad centre in Godot 2D space (+Y down), then Y-negated. Centred, it sits at
  // `offset`. Otherwise the top-left does, so the centre is offset + (w/2, h/2).
  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

  // The map is here at the first compile, but the decode can change: a
  // ViewportTexture keeps its colour space where a `res://` file gets the canvas
  // retag, and a swap changes the program (`materialProgramInputs.ts`).
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

