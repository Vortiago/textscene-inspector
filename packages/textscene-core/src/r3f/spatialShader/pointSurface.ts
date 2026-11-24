import * as THREE from 'three';
import { emulatedPointGeometry, type DrawRange } from '../../shaders/spatial/meshAttributes.js';
import type { PointDraw } from '../../shaders/spatial/spatialPipeline.js';
import { NO_RAYCAST } from '../../shaders/pipeline/noRaycast.js';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial.js';

type SurfaceHost = THREE.Object3D & { geometry: THREE.BufferGeometry };

/** The draw group of each emulated draw, whose quads are rebuilt from its parent's surface on a change. */
// eslint-disable-next-line no-restricted-syntax -- written by drawPoints, cleared when the draw is collected
const emulatedGroups = new WeakMap<THREE.Object3D, number | null>();

/** A child draws the points (`scene_shader_forward_clustered.cpp:417`). Null when the host already does. */
export function drawPoints(
  host: SurfaceHost,
  drawGroup: number | null,
  material: THREE.Material,
  pointDraw: PointDraw
): (() => void) | null {
  if (pointDraw === 'native' && (host as THREE.Points).isPoints) return null;
  const drawn =
    pointDraw === 'native'
      ? nativePoints(host.geometry, drawGroup, material)
      : emulated(host, drawGroup, material);
  drawn.raycast = NO_RAYCAST;
  drawn.castShadow = host.castShadow;
  drawn.receiveShadow = host.receiveShadow;
  drawn.renderOrder = host.renderOrder;
  drawn.layers.mask = host.layers.mask;
  host.add(drawn);
  return () => {
    host.remove(drawn);
    if (pointDraw === 'emulated') drawn.geometry.dispose();
  };
}

function nativePoints(geometry: THREE.BufferGeometry, drawGroup: number | null, material: THREE.Material) {
  return new THREE.Points(geometry, drawGroup === null ? material : groupMaterials(drawGroup, material));
}

/** Each group's material: `material` at `drawGroup`, the others drawing nothing. */
function groupMaterials(drawGroup: number, material: THREE.Material): THREE.Material[] {
  return Array.from({ length: drawGroup + 1 }, (_, group) =>
    group === drawGroup ? material : OTHER_DRAWS_SURFACE
  );
}

function emulated(host: SurfaceHost, drawGroup: number | null, material: THREE.Material) {
  const drawn = new THREE.Mesh(
    emulatedPointGeometry(host.geometry, groupRange(host.geometry, drawGroup)),
    material
  );
  emulatedGroups.set(drawn, drawGroup);
  return drawn;
}

/** Rebuilds the quads of emulated points `drawn` after `withGodotSurface` writes its parent's surface. */
export function refreshEmulatedPoints(drawn: THREE.Mesh, surface: THREE.BufferGeometry): void {
  drawn.geometry.dispose();
  drawn.geometry = emulatedPointGeometry(surface, groupRange(surface, emulatedGroups.get(drawn) ?? null));
}

/** Whether `drawn` draws emulated points, whose geometry is quads and no surface of its own. */
export const isEmulatedPoints = (drawn: THREE.Object3D): boolean => emulatedGroups.has(drawn);

/** The corners of `surface` that `group` draws, or the whole surface for no group. */
function groupRange(surface: THREE.BufferGeometry, group: number | null): DrawRange | undefined {
  if (group === null) return undefined;
  const range = surface.groups[group];
  if (!range)
    throw new Error(`expected a draw group ${group} on the surface, found ${surface.groups.length}`);
  return range;
}
