import * as THREE from 'three';
import { emulatedPointGeometry, type DrawRange } from '../../shaders/spatial/meshAttributes.js';
import type { PointDraw } from '../../shaders/spatial/spatialPipeline.js';
import { NO_RAYCAST } from '../../shaders/pipeline/noRaycast.js';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial.js';
import { followVisualLayers } from '../visualLayers.js';

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
    pointDraw === 'native' ? nativePoints(host, drawGroup, material) : emulated(host, drawGroup, material);
  drawn.raycast = NO_RAYCAST;
  followHostDraw(drawn, host);
  host.add(drawn);
  return () => {
    host.remove(drawn);
    if (pointDraw === 'emulated') drawn.geometry.dispose();
  };
}

/** What a live edit of the host can change about how it draws, which the points read from it. */
const HOST_DRAW_STATE = [
  'castShadow',
  'receiveShadow',
  'renderOrder',
  'frustumCulled',
  'layers',
  'onBeforeRender',
  'onAfterRender',
  'onBeforeShadow',
  'onAfterShadow',
] as const;

/** `drawn` draws as `host` does at each draw: no copy goes stale when a live edit changes the host. */
function followHostDraw(drawn: THREE.Object3D, host: SurfaceHost): void {
  for (const key of HOST_DRAW_STATE) Object.defineProperty(drawn, key, { get: () => host[key] });
  followVisualLayers(drawn, host);
}

/** Points of the host's surface as it is at each draw, so a new mesh on the host draws at once. */
function nativePoints(host: SurfaceHost, drawGroup: number | null, material: THREE.Material): THREE.Points {
  const drawn = new THREE.Points(
    host.geometry,
    drawGroup === null ? material : groupMaterials(drawGroup, material)
  );
  Object.defineProperty(drawn, 'geometry', { get: () => host.geometry });
  return drawn;
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
  const drawing = drawn.geometry;
  drawn.geometry = emulatedPointGeometry(surface, groupRange(surface, emulatedGroups.get(drawn) ?? null));
  // Disposed after this draw: three draws the geometry its render list took (r187 `WebGLRenderer.js:2182`).
  queueMicrotask(() => drawing.dispose());
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
