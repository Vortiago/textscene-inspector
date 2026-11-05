/**
 * Draws a MeshInstance2D: a CanvasItem2D whose body is the mesh `useCanvasMeshContent` reads, each
 * surface at its vertices' x and y, in surface order, with no depth test and no face culling. The
 * surfaces' own materials never apply: the canvas item's pipeline draws them
 * (`renderer_canvas_render_rd.cpp:3187-3212`). A node with no mesh, or one Godot builds no surface
 * for, draws nothing and its children still draw (`mesh_instance_2d.cpp:45-53`).
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import type { CanvasItemPixelMaterial } from '../../../r3f/components/LitCanvasItemPixels';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { canvasMapProps, useCanvas2DTexture } from '../../../r3f/canvas2DTextureDecode';
import { CanvasItemSurfaceSource } from '../../../r3f/canvasItemSurface';
import { useCanvasTextureSampler, useNode2DTextureSampler } from '../../../r3f/canvasItemTextureSampler';
import { CANVAS_SRGB_DEFINES } from '../../../r3f/canvasSrgbMultiply';
import type { CanvasItemSurface } from '../../../r3f/lighting2d/normalMappedLighting';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { canvasMeshGeometry } from '../../../r3f/meshes/canvasMeshGeometry';
import { useCanvasMeshContent, type SurfacedMesh } from '../../../r3f/meshes/meshContent';
import { canvasPointSize } from '../../../r3f/materials/godotPoint';
import { geometryDrawsLines, geometryDrawsPoints } from '../../../resources/meshes/godotSurface';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { useTexture2D } from '../../../resources/useTexture2D';
import type { MeshInstance2DProperties } from './types';

export function MeshInstance2D({ node, children }: NodeComponentProps) {
  const props = node.properties as MeshInstance2DProperties;
  const pools = useSceneResources();
  const content = useCanvasMeshContent(useResourceResolution(props.mesh, pools));
  const geometries = useCanvasGeometries(content.kind === 'surfaced' ? content.mesh : null);

  const {
    texture: sourceTexture,
    missing: textureMissing,
    isArriving: textureArriving,
    canvasTexture,
  } = useTexture2D(props.texture, pools.externalResources, pools.internalResources);
  // A CanvasTexture's own filter and repeat win over the item's.
  const sampler = useCanvasTextureSampler(useNode2DTextureSampler(props), canvasTexture?.texture);
  const texture = useCanvas2DTexture(sourceTexture, sampler);
  const [surface, setSurface] = useState<CanvasItemSurface | null>(null);

  // A fragment either way, so the item keeps its place when the source mounts.
  return (
    <>
      <CanvasItem2D
        node={node}
        props={props}
        surface={surface}
        body={({ color, opacity }, _material, pixelMaterial) => {
          // No texture draws white. A texture that is set but not here yet draws nothing, and one
          // that never draws gets the placeholder.
          if (textureMissing) return <MissingResourcePlaceholder shape="plane" name={node.name} />;
          if (textureArriving) return null;
          return geometries.map((geometry) => (
            <CanvasSurfaces
              key={geometry.uuid}
              geometry={geometry}
              texture={texture}
              color={color}
              opacity={opacity}
              pixelMaterial={pixelMaterial}
            />
          ));
        }}
      >
        {children}
      </CanvasItem2D>
      {canvasTexture?.texture.normalTexture && (
        <CanvasItemSurfaceSource slot={canvasTexture} sampler={sampler} onSurface={setSurface} />
      )}
    </>
  );
}

const NO_GEOMETRIES: readonly THREE.BufferGeometry[] = [];

/** The canvas geometry of each part of `mesh`, released when the mesh changes or the node unmounts. */
function useCanvasGeometries(mesh: SurfacedMesh | null): readonly THREE.BufferGeometry[] {
  const geometries = useMemo(
    () => (mesh ? mesh.parts.map((part) => canvasMeshGeometry(part.geometry)) : NO_GEOMETRIES),
    [mesh]
  );
  const disposable = useMemo(() => ({ dispose: () => geometries.forEach((g) => g.dispose()) }), [geometries]);
  useDisposeOnRelease(disposable);
  return geometries;
}

/** One part of the mesh: triangles, points or line segments, by the primitive its geometry draws. */
function CanvasSurfaces({
  geometry,
  texture,
  color,
  opacity,
  pixelMaterial,
}: {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture | null;
  color: THREE.Color;
  opacity: number;
  pixelMaterial: CanvasItemPixelMaterial;
}) {
  const hasVertexColors = geometry.hasAttribute('color');
  const drawsPoints = geometryDrawsPoints(geometry);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const map = canvasMapProps(texture);
  const point = drawsPoints ? canvasPointSize(pixelRatio) : undefined;
  // The map and the vertex colours are sRGB numbers that Godot multiplies as stored
  // (`canvas.glsl:172-181`), and the define is a program input, so it keys the material.
  const program = materialProgramInputs({
    props: {
      ...map,
      color,
      opacity,
      vertexColors: hasVertexColors,
      transparent: true,
      depthWrite: false,
      // Godot's canvas culls no face, and the y flip reverses every triangle's winding.
      side: THREE.DoubleSide,
      defines: hasVertexColors ? CANVAS_SRGB_DEFINES : map.defines,
      // three leaves `gl_PointSize` unwritten for a mesh material.
      injection: point?.injection,
      userData: point?.userData,
    },
    merge: [pixelMaterial],
  });

  const material = <meshBasicMaterial key={program.key} {...program.props} />;
  const Draw = drawsPoints ? 'points' : geometryDrawsLines(geometry) ? 'lineSegments' : 'mesh';
  return (
    <Draw>
      <primitive object={geometry} attach="geometry" />
      {material}
    </Draw>
  );
}
