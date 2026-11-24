/**
 * The one material of a canvas mesh surface: an unlit `meshBasicMaterial` that samples the item's
 * texture, multiplies its vertex colours as the canvas colour space does, blends with no depth
 * write and merges the item's pixel material. `CanvasMeshBody` mounts it on each surface.
 */

import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { canvasMapProps } from '../canvas2DTextureDecode';
import { instanceColorDefines, useCanvasColorSpace, type CanvasColorSpace } from '../canvasColorSpace';
import { canvasPointSize } from '../materials/godotPoint';
import { materialProgramInputs, type ProgramInjection } from '../materialProgramInputs';
import type { CanvasItemPixelMaterial } from '../components/LitCanvasItemPixels';
import type { CanvasVertexColors } from './canvasSurface';

interface CanvasSurfaceMaterialProps {
  /** The texture view the surface samples, or null for none. */
  map: THREE.Texture | null;
  color: THREE.Color;
  opacity: number;
  /** What the geometry's `color` attribute holds, or null for a geometry with none. */
  vertexColors: CanvasVertexColors | null;
  /** True for a surface drawn as points, whose size three leaves unwritten. */
  drawsPoints: boolean;
  pixelMaterial: CanvasItemPixelMaterial;
  /** Program edits after the pixel material, in order, as a tile run's padding and normal orientation. */
  injections?: readonly (ProgramInjection | undefined)[];
}

const NO_INJECTIONS: readonly (ProgramInjection | undefined)[] = [];

export function CanvasSurfaceMaterial({
  map,
  color,
  opacity,
  vertexColors,
  drawsPoints,
  pixelMaterial,
  injections = NO_INJECTIONS,
}: CanvasSurfaceMaterialProps) {
  const canvasSpace = useCanvasColorSpace();
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const mapProps = canvasMapProps(map, canvasSpace);
  const point = drawsPoints ? canvasPointSize(pixelRatio) : undefined;
  // The define is a program input, so it keys the material: a late texture mounts a new one.
  const program = materialProgramInputs({
    props: {
      ...mapProps,
      color,
      opacity,
      vertexColors: vertexColors !== null,
      transparent: true,
      depthWrite: false,
      defines: vertexColors ? vertexColorDefines(canvasSpace, vertexColors) : mapProps.defines,
      injection: point?.injection,
      userData: point?.userData,
    },
    // The facing in `pixelMaterial` draws one pass whatever the winding, so a bent skin's
    // triangles and per-vertex alpha keep their index order.
    merge: [pixelMaterial, ...injections.map((injection) => injection && { injection })],
  });
  return <meshBasicMaterial key={program.key} {...program.props} />;
}

/**
 * The defines of a surface with vertex colours, which also govern its map. An sRGB canvas
 * multiplies them as sRGB numbers (`canvas.glsl:181`). A linear canvas decodes stored colours in
 * the shader, and an instanced copy holds them decoded already, times the instance colour it
 * multiplies raw (`canvas.glsl:255`). One define governs both multiplies, so the vertex colours win.
 */
function vertexColorDefines(
  canvasSpace: CanvasColorSpace,
  vertexColors: CanvasVertexColors
): Readonly<Record<string, string>> | undefined {
  return vertexColors === 'instance' ? instanceColorDefines(canvasSpace) : canvasSpace.defines;
}
