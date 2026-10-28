/**
 * Draws a Sprite2D: a CanvasItem2D whose body is a quad sized to the texture's
 * pixels (1 px = 1 world unit). The region and frame math is shared with Sprite3D
 * in `r3f/spriteFrame`. Flipping stays here: 2D mirrors by mesh scale, which
 * flips the texture too, as in Godot, where 3D negates the UV.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import type { CanvasItemPixelMaterial } from '../../../r3f/components/LitCanvasItemPixels';
import { frameSizePx, frameUvWindow } from '../../../r3f/spriteFrame';
import { useNode2DTextureSampler } from '../../../r3f/canvasItemTextureSampler';
import { useUvWindow } from '../../../r3f/useUvWindow';
import { canvasMapProps, useCanvas2DTexture } from '../../../r3f/canvas2DTextureDecode';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { useTexture2D } from '../../../resources/useTexture2D';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { Sprite2DProperties } from './types';

export function Sprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Sprite2DProperties;
  const { externalResources, internalResources } = useSceneResources();

  // An active AnimationPlayer can drive the sheet `frame` (ADR-0016), and `null`
  // means none does. The registry carries a numeric tuple (ADR-0017), here a 1-tuple.
  const animatedFrame = useAnimatedValue('frame', (v) => v[0] ?? null);

  const { texture: sourceTexture, missing: textureMissing } = useTexture2D(
    props.texture,
    externalResources,
    internalResources
  );

  // With `texture_repeat` Disabled, an overrunning `region_rect` stretches its edge texels,
  // where Sprite3D tiles.
  const sampler = useNode2DTextureSampler(props);
  const drawnTexture = useCanvas2DTexture(sourceTexture, sampler);
  // A driven `frame` overrides the authored `frame` and any authored
  // `frame_coords` (in Godot the two are the same value), so the animation wins.
  const frameWindow = useMemo(() => {
    const frameProps =
      animatedFrame !== null ? { ...props, frame: animatedFrame, frame_coords: undefined } : props;
    return frameUvWindow(sourceTexture ?? undefined, frameProps);
  }, [sourceTexture, props, animatedFrame]);
  useUvWindow(drawnTexture, frameWindow);

  // Quad size in pixels (1 px = 1 world unit in the 2D canvas). A render
  // target reports its rect through the same `image` shape a loaded texture
  // uses, so the sizing path is shared.
  const { width, height } = useMemo(
    () => frameSizePx(sourceTexture ?? undefined, props),
    [sourceTexture, props]
  );

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }, _material, pixelMaterial) =>
        // No texture draws nothing, as Godot's draw returns early (`sprite_2d.cpp:159`). The
        // placeholder is for a texture that is set but never draws.
        textureMissing ? (
          <MissingResourcePlaceholder shape="plane" name={node.name} />
        ) : drawnTexture ? (
          <QuadMesh
            texture={drawnTexture}
            color={color}
            opacity={opacity}
            width={width}
            height={height}
            props={props}
            pixelMaterial={pixelMaterial}
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
  pixelMaterial,
}: {
  texture: THREE.Texture;
  color: THREE.Color;
  opacity: number;
  width: number;
  height: number;
  props: Sprite2DProperties;
  pixelMaterial: CanvasItemPixelMaterial;
}) {
  // Quad centre in Godot 2D space (+Y down), then Y-negated. Centred, it sits at
  // `offset`. Otherwise the top-left does, so the centre is offset + (w/2, h/2).
  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

  // The map is here at the first compile, but the define can change: a 3D-content
  // ViewportTexture multiplies linearly where a canvas-content one and a `res://` file
  // multiply in sRGB, and a swap changes the program (`materialProgramInputs.ts`).
  const program = materialProgramInputs({
    props: {
      ...canvasMapProps(texture),
      color,
      opacity,
      transparent: true,
      depthWrite: false,
    },
    merge: [pixelMaterial],
  });

  return (
    <mesh position={[cgx, -cgy, 0]} scale={meshScale}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
