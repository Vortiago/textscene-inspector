/**
 * <PointLight2D> — a 2D point light that renders a textured quad
 * with additive/subtractive/normal blending, wrapped in a CanvasItem2D
 * group so the transform, z-index and visibility match the 2D canvas.
 *
 * When `enabled=false` the body callback returns null so no mesh
 * enters the tree at all (no additiveMaterials in the registry).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { resolveTexture2DPath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { PointLight2DProperties } from './types';

export function PointLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as PointLight2DProperties;
  const { externalResources, internalResources } = useSceneResources();

  // Resolve the light texture path.
  const texturePath = useMemo(
    () => resolveTexture2DPath(props.texture, externalResources, internalResources),
    [props.texture, externalResources, internalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');
  // The texture is owned by the shared resource loader — do NOT dispose it here
  // (it may be shared by other PointLight2Ds using the same SubResource).
  const displayedTexture = texResult.value;

  // Show placeholder when no texture path or loading failed.
  const showPlaceholder = !texturePath || texResult.status === 'unavailable';

  // Emitted colour: Godot sRGB → linear, scaled by energy. NOT clamped — an
  // additive light with energy > 1 is meant to over-brighten (bloom).
  const litColor = useMemo(
    () => godotColorToLinear(props.color).multiplyScalar(props.energy),
    [props.color, props.energy]
  );

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
            color={litColor}
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
  scale,
  offset,
  blendMode,
}: {
  texture: THREE.Texture;
  color: THREE.Color;
  scale: number;
  offset: { x: number; y: number };
  blendMode: number;
}) {
  let blending: THREE.Blending = THREE.NormalBlending;
  switch (blendMode) {
    case 0:
      blending = THREE.AdditiveBlending;
      break;
    case 1:
      blending = THREE.SubtractiveBlending;
      break;
    case 2:
      blending = THREE.NormalBlending;
      break;
  }

  const width = (texture.image as { width?: number } | null | undefined)?.width ?? 1;
  const height = (texture.image as { height?: number } | null | undefined)?.height ?? 1;

  return (
    <mesh position={[offset.x, -offset.y, 0]}>
      <planeGeometry args={[width * scale, height * scale]} />
      <meshBasicMaterial
        map={texture}
        color={color}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={blending}
      />
    </mesh>
  );
}
