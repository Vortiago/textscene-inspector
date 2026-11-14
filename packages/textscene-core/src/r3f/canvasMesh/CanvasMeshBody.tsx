/**
 * The body a Node2D mesh drawer draws through: the CanvasItem ritual of `CanvasItem2D`, the
 * texture's load state, the placeholder, the lighting hand-back and one material for each surface.
 * A drawer states its texture (`useCanvasMeshTexture`) and its surfaces, and nothing else.
 * CPUParticles2D, the tile mesh and CanvasGroup still draw their own (#1546).
 */

import { useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import { geometryPrimitive } from '../../resources/meshes/godotSurface';
import { drawnTag } from '../meshes/meshContent';
import { useArrayColorOf, type CanvasItemTint } from '../canvasItemModulate';
import { CanvasItem2D } from '../components/CanvasItem2D';
import type { CanvasItemPixelMaterial } from '../components/LitCanvasItemPixels';
import { MissingResourcePlaceholder } from '../components/MissingResourcePlaceholder';
import { CanvasSurfaceMaterial } from './CanvasSurfaceMaterial';
import { DRAWN_TEXTURE, type CanvasMeshTexture } from './useCanvasMeshTexture';
import type { CanvasSurface } from './canvasSurface';

type CanvasSurfaces = readonly CanvasSurface[] | null;

/**
 * The surfaces of a drawer whose geometry reads the CanvasItemMaterial in force, as a particles
 * flipbook does: a hook of `input` and the material, which the body calls in one component.
 * `CanvasItem2D` resolves that material, so the drawer cannot. Pass a module-level function: the
 * body calls it as a hook, so a new function each render breaks the hook order.
 */
export interface MaterialSurfaces<Input> {
  readonly input: Input;
  readonly useSurfaces: (input: Input, material: CanvasItemMaterialProperties | null) => CanvasSurfaces;
}

interface CanvasMeshBodyProps<Input> {
  node: TscnNode;
  props: Node2DProperties;
  texture: CanvasMeshTexture;
  /**
   * What the item draws with no image. 'white' draws the surfaces with no map, for a texture that
   * is unset or failed, as Polygon2D, Line2D and a mesh do: Godot's loader leaves a property that
   * names a missing file null (`resource_format_text.cpp:146-154`, `:288-289`). 'nothing' draws
   * nothing while unset (`sprite_2d.cpp:159`) and the placeholder for a texture that failed.
   */
  withoutTexture: 'white' | 'nothing';
  /** The surfaces in draw order, or null to draw nothing. Its children still draw. */
  surfaces: CanvasSurfaces | MaterialSurfaces<Input>;
  /** True shows the placeholder whatever the texture's state, as for a SpriteFrames that failed. */
  showsPlaceholder?: boolean;
  children?: ReactNode;
}

/** @canonical The draw of a Node2D canvas mesh drawer */
export function CanvasMeshBody<Input>({
  node,
  props,
  texture,
  withoutTexture,
  surfaces,
  showsPlaceholder = false,
  children,
}: CanvasMeshBodyProps<Input>) {
  const { view, canvasTexture } = texture[DRAWN_TEXTURE];
  // A texture that is not here yet draws nothing, whatever the item draws with no image.
  const drawsWhite = withoutTexture === 'white';
  const isMissing = showsPlaceholder || (texture.state === 'missing' && !drawsWhite);
  const texturePermitsDraw = texture.state === 'ready' || (texture.state !== 'arriving' && drawsWhite);
  const isDrawn = !isMissing && texturePermitsDraw && surfaces !== null;
  return (
    <CanvasItem2D
      node={node}
      props={props}
      canvasTexture={canvasTexture}
      isDrawn={isDrawn}
      body={(tint, material, pixelMaterial) => {
        if (isMissing) return <MissingResourcePlaceholder shape="plane" name={node.name} />;
        if (!isDrawn) return null;
        const drawn = { map: view, tint, pixelMaterial };
        return isMaterialSurfaces(surfaces) ? (
          <SurfacesOfMaterial surfaces={surfaces} material={material} {...drawn} />
        ) : (
          <SurfaceMeshes surfaces={surfaces} {...drawn} />
        );
      }}
    >
      {children}
    </CanvasItem2D>
  );
}

interface DrawnSurfaces {
  map: THREE.Texture | null;
  tint: CanvasItemTint;
  pixelMaterial: CanvasItemPixelMaterial;
}

function isMaterialSurfaces<Input>(
  surfaces: readonly CanvasSurface[] | MaterialSurfaces<Input>
): surfaces is MaterialSurfaces<Input> {
  return !Array.isArray(surfaces);
}

function SurfacesOfMaterial<Input>({
  surfaces: { input, useSurfaces },
  material,
  ...drawn
}: DrawnSurfaces & { surfaces: MaterialSurfaces<Input>; material: CanvasItemMaterialProperties | null }) {
  const surfaces = useSurfaces(input, material);
  return surfaces && <SurfaceMeshes surfaces={surfaces} {...drawn} />;
}

function SurfaceMeshes({ surfaces, ...drawn }: DrawnSurfaces & { surfaces: readonly CanvasSurface[] }) {
  // Keyed by place, so a rebuilt geometry keeps its mesh, and a skin bound to it stays bound.
  return surfaces.map((surface, i) => <SurfaceMesh key={i} surface={surface} {...drawn} />);
}

/** One surface: triangles, points or line segments, by the primitive its geometry draws. */
function SurfaceMesh({ surface, map, tint, pixelMaterial }: DrawnSurfaces & { surface: CanvasSurface }) {
  const { geometry, arrayColor, vertexColors = 'stored', position, scale, meshRef } = surface;
  const arrayColorOf = useArrayColorOf();
  const { color, opacity } = useMemo(
    () =>
      arrayColor
        ? { color: arrayColorOf(tint.own, arrayColor), opacity: tint.own.a * arrayColor.a }
        : { color: tint.color, opacity: tint.opacity },
    [arrayColor, arrayColorOf, tint]
  );
  const primitive = geometryPrimitive(geometry);
  const Draw = drawnTag(primitive);
  return (
    <Draw ref={meshRef} position={position} scale={scale}>
      <primitive object={geometry} attach="geometry" />
      <CanvasSurfaceMaterial
        map={map}
        color={color}
        opacity={opacity}
        vertexColors={geometry.hasAttribute('color') ? vertexColors : null}
        drawsPoints={primitive === 'points'}
        pixelMaterial={pixelMaterial}
      />
    </Draw>
  );
}
