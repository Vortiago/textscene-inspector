/**
 * <PointLight2D> — a 2D point light. It draws nothing on the canvas, as Godot's
 * lights do not: it contributes its cookie to the accumulation buffer that
 * every lit canvas item multiplies its albedo against (see
 * `r3f/lighting2d/CanvasLighting2D`).
 *
 * The quad sits on the light camera layer, so the main pass never sees it and
 * the light pre-pass sees nothing else. It is still wrapped in CanvasItem2D so
 * its transform, `visible` and z come from the same ritual as any other node.
 *
 * When `enabled=false` the body returns null and the light does not register.
 */

import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { PointLight2DProperties } from './types';
import type { Color } from '../../base/node2d/types';
import { createLightQuadMaterial } from '../../../r3f/lighting2d/lightQuad';
import {
  LIGHT_LAYER,
  useRegisterCanvasLight2D,
} from '../../../r3f/lighting2d/CanvasLighting2D';

export function PointLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as PointLight2DProperties;
  const { externalResources, internalResources } = useSceneResources();

  // The light cookie is a Texture2D slot like any other, and in real scenes it
  // is usually a GradientTexture2D — a radial falloff described inline rather
  // than shipped as an image. `useTexture2D` resolves either kind.
  const { texture: displayedTexture, missing } = useTexture2D(
    props.texture,
    externalResources,
    internalResources
  );
  const showPlaceholder = missing || !props.texture;

  const lights = props.enabled && !!displayedTexture ? 1 : 0;
  useRegisterCanvasLight2D(lights > 0);

  // When disabled: return null → no mesh in tree.
  if (!props.enabled) return null;

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={() =>
        showPlaceholder ? (
          <MissingResourcePlaceholder shape="plane" name={node.name} />
        ) : displayedTexture ? (
          <QuadMesh
            texture={displayedTexture}
            color={props.color}
            energy={props.energy}
            scale={props.texture_scale}
            offset={props.offset}
            blendMode={props.blend_mode}
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
  energy,
  scale,
  offset,
  blendMode,
}: {
  texture: THREE.Texture;
  color: Color;
  energy: number;
  scale: number;
  offset: { x: number; y: number };
  blendMode: number;
}) {
  const width = (texture.image as { width?: number } | null | undefined)?.width ?? 1;
  const height = (texture.image as { height?: number } | null | undefined)?.height ?? 1;

  const material = useMemo(
    () => createLightQuadMaterial(texture, color, energy, blendMode),
    [texture, color, energy, blendMode]
  );
  useEffect(() => () => material.dispose(), [material]);

  // The light layer is what keeps this quad out of the visible pass: the
  // accumulation pre-pass renders that layer alone, the main pass renders
  // everything else.
  const toLightLayer = useCallback((mesh: THREE.Mesh | null) => {
    mesh?.layers.set(LIGHT_LAYER);
  }, []);

  return (
    <mesh ref={toLightLayer} position={[offset.x, -offset.y, 0]} material={material}>
      <planeGeometry args={[width * scale, height * scale]} />
    </mesh>
  );
}
