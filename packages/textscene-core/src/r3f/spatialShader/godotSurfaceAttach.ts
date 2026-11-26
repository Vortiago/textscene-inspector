import type * as THREE from 'three';
import type { PointDraw } from '../../shaders/spatial/spatialPipeline';
import {
  drawGroupOf,
  materialAt,
  placeMaterial,
  type MaterialAttach,
  type MaterialHost,
} from '../materials/swappedMaterials';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial';
import type { drawPoints, withGodotSurface } from './spatialSurface';

export interface GodotSurfaceHost extends MaterialHost, THREE.Object3D {
  geometry: THREE.BufferGeometry;
}

/** The parts of the lazily loaded spatial surface module the attach calls. */
export interface SurfaceModule {
  withGodotSurface: typeof withGodotSurface;
  drawPoints: typeof drawPoints;
}

/** Where a surface's material goes: its R3F attach key, and a fade's swap of that surface, if any. */
export interface SurfaceMount {
  /** `material-N` for a mesh of several surfaces, which names the draw group. */
  readonly attach?: string;
  /** The fade's swap, which places the material at that draw group itself. */
  readonly swap?: MaterialAttach;
}

/** Godot's attributes before the material: three builds the program from the attributes of the first draw. */
export function godotSurfaceAttach(
  { attach, swap }: SurfaceMount,
  module: SurfaceModule,
  pointDraw: PointDraw | null,
  scene: THREE.Scene
) {
  const drawGroup = drawGroupOf(attach);
  const placed = swap ?? placedAt(drawGroup);
  return (host: GodotSurfaceHost, material: THREE.Material) => {
    if (host.geometry.getAttribute('position')) module.withGodotSurface(host.geometry);
    const stopPoints = pointDraw && module.drawPoints(host, drawGroup, material, pointDraw, scene);
    const detach = placed(host, stopPoints ? OTHER_DRAWS_SURFACE : material);
    return () => {
      stopPoints?.();
      detach();
    };
  };
}

/** Places a material at `drawGroup`, and puts back the one it replaced on detach. */
const placedAt =
  (drawGroup: number | null): MaterialAttach =>
  (host, material) => {
    const previous = materialAt(host, drawGroup);
    placeMaterial(host, drawGroup, material);
    return () => {
      if (previous) placeMaterial(host, drawGroup, previous);
    };
  };
