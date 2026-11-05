/**
 * A canvas item whose body is a mesh drawn on the 2D canvas, each surface at its vertices' x and y,
 * in surface order, with no depth test and no face culling. The surfaces' own materials never
 * apply: the canvas item's pipeline draws them (`renderer_canvas_render_rd.cpp:3187-3212`).
 * MeshInstance2D draws the mesh once. MultiMeshInstance2D draws it for each instance of its MultiMesh.
 */

import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { geometryPrimitive } from '../../resources/meshes/godotSurface';
import type { MultiMeshInstance } from '../../resources/meshes/multimesh';
import { useTexture2D } from '../../resources/useTexture2D';
import { canvasMapProps, useCanvas2DTexture } from '../canvas2DTextureDecode';
import { useNode2DCanvasTextureSampler } from '../canvasItemTextureSampler';
import { instanceColorDefines, useCanvasColorSpace, type CanvasColorSpace } from '../canvasColorSpace';
import { sRGBChannelToLinear } from '../../utils/colorSpace';
import { canvasMeshGeometry } from '../meshes/canvasMeshGeometry';
import { canvasInstancesGeometry, MESH_INSTANCE } from '../meshes/canvasMeshInstances';
import { drawnTag, type SurfacedMesh } from '../meshes/meshContent';
import { canvasPointSize } from '../materials/godotPoint';
import { materialProgramInputs } from '../materialProgramInputs';
import { particlesFlipbook, type ParticlesFlipbook } from '../particlesFlipbook';
import { useSceneResources } from '../SceneResourcesContext';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import { CanvasItem2D } from './CanvasItem2D';
import type { CanvasItemPixelMaterial } from './LitCanvasItemPixels';
import { MissingResourcePlaceholder } from './MissingResourcePlaceholder';

interface CanvasMeshItemProps {
  node: TscnNode;
  /** The item's Node2D surface and its `texture` reference. */
  props: Node2DProperties & { texture?: string };
  /** The mesh to draw, or null for a node that draws nothing. Its children still draw. */
  mesh: SurfacedMesh | null;
  /** The instances to draw the mesh for, in order. Absent draws it once, as a MeshInstance2D does. */
  instances?: readonly MultiMeshInstance[];
  children?: ReactNode;
}

export function CanvasMeshItem({ node, props, mesh, instances, children }: CanvasMeshItemProps) {
  const pools = useSceneResources();
  const {
    texture: sourceTexture,
    missing: textureMissing,
    isArriving: textureArriving,
    canvasTexture,
  } = useTexture2D(props.texture, pools.externalResources, pools.internalResources);
  // A CanvasTexture's own filter and repeat win over the item's.
  const sampler = useNode2DCanvasTextureSampler(props, canvasTexture?.texture);
  const texture = useCanvas2DTexture(sourceTexture, sampler);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      canvasTexture={canvasTexture}
      body={({ color, opacity }, material, pixelMaterial) => {
        // No texture draws white. A texture that is set but not here yet draws nothing, and one
        // that never draws gets the placeholder.
        if (textureMissing) return <MissingResourcePlaceholder shape="plane" name={node.name} />;
        if (textureArriving || !mesh) return null;
        return (
          <CanvasMeshParts
            mesh={mesh}
            instances={instances}
            material={material}
            texture={texture}
            color={color}
            opacity={opacity}
            pixelMaterial={pixelMaterial}
          />
        );
      }}
    >
      {children}
    </CanvasItem2D>
  );
}

interface CanvasMeshPartsProps {
  mesh: SurfacedMesh;
  instances: readonly MultiMeshInstance[] | undefined;
  material: CanvasItemMaterialProperties | null;
  texture: THREE.Texture | null;
  color: THREE.Color;
  opacity: number;
  pixelMaterial: CanvasItemPixelMaterial;
}

function CanvasMeshParts({
  mesh,
  instances,
  material,
  texture,
  color,
  opacity,
  pixelMaterial,
}: CanvasMeshPartsProps) {
  // Stable per material: a new object each render would rebuild the merged geometry.
  const flipbook = useMemo(() => particlesFlipbook(material), [material]);
  const canvasSpace = useCanvasColorSpace();
  const geometries = useCanvasGeometries(mesh, instances, flipbook, canvasSpace);
  return geometries.map(({ geometry, isInstanced }) => (
    <CanvasSurfaces
      key={geometry.uuid}
      geometry={geometry}
      defines={vertexColorDefines(canvasSpace, isInstanced)}
      texture={texture}
      color={color}
      opacity={opacity}
      pixelMaterial={pixelMaterial}
    />
  ));
}

/** One part's canvas geometry, and whether its colours are already per instance. */
interface CanvasGeometry {
  geometry: THREE.BufferGeometry;
  isInstanced: boolean;
}

/**
 * The canvas geometry of each part of `mesh`, released when it changes or the node unmounts. A mesh
 * drawn once with no flipbook shares the source buffers. Any other draw builds its own copy, whose
 * vertex colours a linear canvas decodes before the instance colours multiply.
 */
function useCanvasGeometries(
  mesh: SurfacedMesh,
  instances: readonly MultiMeshInstance[] | undefined,
  flipbook: ParticlesFlipbook | null,
  canvasSpace: CanvasColorSpace
): readonly CanvasGeometry[] {
  const geometries = useMemo(() => {
    const drawn = instances ?? (flipbook ? [MESH_INSTANCE] : null);
    const decode = canvasSpace.isLinear ? sRGBChannelToLinear : undefined;
    return mesh.parts.map(({ geometry }) =>
      drawn
        ? { geometry: canvasInstancesGeometry(geometry, drawn, flipbook, decode), isInstanced: true }
        : { geometry: canvasMeshGeometry(geometry), isInstanced: false }
    );
  }, [mesh, instances, flipbook, canvasSpace]);
  const disposable = useMemo(
    () => ({ dispose: () => geometries.forEach(({ geometry }) => geometry.dispose()) }),
    [geometries]
  );
  useDisposeOnRelease(disposable);
  return geometries;
}

/**
 * The defines of a part's vertex colours. An sRGB canvas multiplies them as sRGB numbers
 * (`canvas.glsl:181`). A linear canvas decodes a mesh's own colours in the shader, and an instanced
 * copy holds them decoded already, times the instance colour it multiplies raw (`canvas.glsl:255`).
 */
function vertexColorDefines(
  canvasSpace: CanvasColorSpace,
  isInstanced: boolean
): Readonly<Record<string, string>> | undefined {
  return isInstanced ? instanceColorDefines(canvasSpace) : canvasSpace.defines;
}

/** One part of the mesh: triangles, points or line segments, by the primitive its geometry draws. */
function CanvasSurfaces({
  geometry,
  defines,
  texture,
  color,
  opacity,
  pixelMaterial,
}: {
  geometry: THREE.BufferGeometry;
  defines: Readonly<Record<string, string>> | undefined;
  texture: THREE.Texture | null;
  color: THREE.Color;
  opacity: number;
  pixelMaterial: CanvasItemPixelMaterial;
}) {
  const hasVertexColors = geometry.hasAttribute('color');
  const primitive = geometryPrimitive(geometry);
  const drawsPoints = primitive === 'points';
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const map = canvasMapProps(texture, useCanvasColorSpace());
  const point = drawsPoints ? canvasPointSize(pixelRatio) : undefined;
  // The define is a program input, so it keys the material.
  const program = materialProgramInputs({
    props: {
      ...map,
      color,
      opacity,
      vertexColors: hasVertexColors,
      transparent: true,
      depthWrite: false,
      defines: hasVertexColors ? defines : map.defines,
      // three leaves `gl_PointSize` unwritten for a mesh material.
      injection: point?.injection,
      userData: point?.userData,
    },
    merge: [pixelMaterial],
  });

  const material = <meshBasicMaterial key={program.key} {...program.props} />;
  const Draw = drawnTag(primitive);
  return (
    <Draw>
      <primitive object={geometry} attach="geometry" />
      {material}
    </Draw>
  );
}
