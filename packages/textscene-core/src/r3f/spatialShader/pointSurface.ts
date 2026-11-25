import * as THREE from 'three';
import { emulatedPointGeometry, type DrawRange } from '../../shaders/spatial/meshAttributes.js';
import type { PointDraw } from '../../shaders/spatial/spatialPipeline.js';
import { NO_RAYCAST } from '../../shaders/pipeline/noRaycast.js';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial.js';
import { SURFACE_DRAW_STATE, followSurfaceDrawState } from '../surfaceDrawState.js';
import { observeSceneCamera } from '../sceneRenderCamera.js';
import { surfaceWriteOf, withGodotSurface } from './godotSurfaceWrite.js';
import { geometryBoxUserData } from '../bounds.js';

type SurfaceHost = THREE.Object3D & { geometry: THREE.BufferGeometry };

/** The draw group of each emulated draw, whose quads are rebuilt from its parent's surface on a change. */
// eslint-disable-next-line no-restricted-syntax -- written by `emulated`, cleared when the draw is collected
const emulatedGroups = new WeakMap<THREE.Object3D, number | null>();

/** The points are the host's own draw, so they take its order, shadow receipt and camera layers too. */
const POINTS_DRAW_STATE = [...SURFACE_DRAW_STATE, 'receiveShadow', 'renderOrder', 'layers'] as const;

/** A child draws the points (`scene_shader_forward_clustered.cpp:417`). Null when the host already does. */
export function drawPoints(
  host: SurfaceHost,
  drawGroup: number | null,
  material: THREE.Material,
  pointDraw: PointDraw,
  scene: THREE.Scene
): (() => void) | null {
  if (pointDraw === 'native' && (host as THREE.Points).isPoints) return null;
  const drawn =
    pointDraw === 'native' ? nativePoints(host, drawGroup, material) : emulated(host, drawGroup, material);
  drawn.raycast = NO_RAYCAST;
  followSurfaceDrawState(drawn, host, POINTS_DRAW_STATE);
  host.add(drawn);
  const stopRefresh =
    drawn instanceof THREE.Mesh ? observeSceneCamera(scene, () => refreshEmulatedPoints(drawn, host)) : null;
  return () => {
    stopRefresh?.();
    host.remove(drawn);
    if (pointDraw === 'emulated') drawn.geometry.dispose();
  };
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

function emulated(host: SurfaceHost, drawGroup: number | null, material: THREE.Material): THREE.Mesh {
  const drawn = new THREE.Mesh(
    emulatedPointGeometry(host.geometry, groupRange(host.geometry, drawGroup)),
    material
  );
  emulatedGroups.set(drawn, drawGroup);
  builtFrom.set(drawn, surfaceWriteOf(host.geometry));
  // The quads copy the surface's box. Under an instanced host one surface is not the draw.
  if (!(host as THREE.InstancedMesh).isInstancedMesh) Object.assign(drawn.userData, geometryBoxUserData());
  return drawn;
}

/** The surface write each emulated draw's quads come from. Written by `emulated` and the refresh. */
// eslint-disable-next-line no-restricted-syntax -- a record of the last build, compared before each render
const builtFrom = new WeakMap<THREE.Object3D, unknown>();

/** Rebuilds `drawn`'s quads on a new write of its host's surface, before the render list culls them. */
function refreshEmulatedPoints(drawn: THREE.Mesh, host: SurfaceHost): void {
  const surface = host.geometry;
  if (surface.getAttribute('position')) withGodotSurface(surface);
  const write = surfaceWriteOf(surface);
  if (builtFrom.get(drawn) === write) return;
  builtFrom.set(drawn, write);
  const drawing = drawn.geometry;
  drawn.geometry = emulatedPointGeometry(surface, groupRange(surface, emulatedGroups.get(drawn) ?? null));
  // Disposed after the render: a render of another camera, started before this one, may hold it in its list.
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
