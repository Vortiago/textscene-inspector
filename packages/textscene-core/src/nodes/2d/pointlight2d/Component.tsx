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
import { useTexture2D } from '../../../resources/useTexture2D';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { PointLight2DProperties } from './types';

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
        {...lightBlendState(blendMode)}
      />
    </mesh>
  );
}

/**
 * A 2D light is applied AGAINST the surface, not painted over it.
 *
 * Godot's canvas light pass computes `light = light_texture × color × energy`
 * and then combines it with the item's own albedo, so `Light2D.BlendMode.ADD`
 * leaves the framebuffer at `albedo × (1 + light)` — a dark floor stays dark
 * under a torch, a pale wall catches it. Painting the cookie on with plain
 * additive blending instead gives `albedo + light`, which washes the whole
 * neighbourhood toward white regardless of what is underneath. With 23 lights
 * over one dungeon that is the difference between torchlight and fog.
 *
 * `DstColorFactor` recovers Godot's equation exactly without a second pass or a
 * framebuffer read: the destination IS the albedo by the time the light draws,
 * so `src × DST + dst × ONE` is `albedo × (1 + light)`. SUB is the same product
 * subtracted. Alpha is left alone (`Zero`/`One`) — a light contributes colour,
 * never coverage.
 *
 * MIX has no such identity (it interpolates toward the light colour by the
 * light's alpha, which needs the destination as a term on both sides), so it
 * stays an ordinary blend — see the slice's comparison sheet.
 */
const AGAINST_SURFACE = {
  blending: THREE.CustomBlending,
  blendSrc: THREE.DstColorFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
  blendEquationAlpha: THREE.AddEquation,
} as const;

const LIGHT_BLEND: Record<number, THREE.MeshBasicMaterialParameters> = {
  0: { ...AGAINST_SURFACE, blendEquation: THREE.AddEquation },
  1: { ...AGAINST_SURFACE, blendEquation: THREE.ReverseSubtractEquation },
  2: { blending: THREE.NormalBlending },
};

function lightBlendState(blendMode: number): THREE.MeshBasicMaterialParameters {
  return LIGHT_BLEND[blendMode] ?? LIGHT_BLEND[0]!;
}
