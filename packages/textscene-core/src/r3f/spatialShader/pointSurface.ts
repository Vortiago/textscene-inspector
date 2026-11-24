import * as THREE from 'three';
import { emulatedPointGeometry, type DrawRange } from '../../shaders/spatial/meshAttributes.js';
import type { PointDraw } from '../../shaders/spatial/spatialPipeline.js';

/** The host's own draw of a group that its points draw in place of: nothing. */
const UNDRAWN = new THREE.MeshBasicMaterial({ visible: false });

/** The surface each emulated draw reads, by draw: its quads are rebuilt when the surface changes. */
// eslint-disable-next-line no-restricted-syntax -- written by drawPoints, cleared when the draw is collected
const emulatedSources = new WeakMap<
  THREE.Object3D,
  { surface: THREE.BufferGeometry; group: number | null }
>();

/** A child draws the points (`scene_shader_forward_clustered.cpp:417`). Null when the host already does. */
export function drawPoints(
  host: THREE.Mesh | THREE.Points | THREE.LineSegments,
  drawGroup: number | null,
  material: THREE.Material,
  pointDraw: PointDraw
): (() => void) | null {
  if (pointDraw === 'native' && (host as THREE.Points).isPoints) return null;
  const drawn =
    pointDraw === 'native'
      ? nativePoints(host.geometry, drawGroup, material)
      : emulated(host, drawGroup, material);
  drawn.raycast = () => undefined;
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

/** The host's material slot of the group the points take, which draws nothing while they do. */
export const undrawnMaterial = (): THREE.Material => UNDRAWN;

function nativePoints(geometry: THREE.BufferGeometry, drawGroup: number | null, material: THREE.Material) {
  return new THREE.Points(geometry, drawGroup === null ? material : groupMaterials(drawGroup, material));
}

/** Each group's material: `material` at `drawGroup`, the others drawing nothing. */
function groupMaterials(drawGroup: number, material: THREE.Material): THREE.Material[] {
  return Array.from({ length: drawGroup + 1 }, (_, group) => (group === drawGroup ? material : UNDRAWN));
}

function emulated(
  host: THREE.Object3D & { geometry: THREE.BufferGeometry },
  drawGroup: number | null,
  material: THREE.Material
) {
  const drawn = new THREE.Mesh(
    emulatedPointGeometry(host.geometry, groupRange(host.geometry, drawGroup)),
    material
  );
  emulatedSources.set(drawn, { surface: host.geometry, group: drawGroup });
  return drawn;
}

/** Rebuilds the quads of `drawn` after `withGodotSurface` writes its surface. False for no emulated draw. */
export function refreshEmulatedPoints(drawn: THREE.Object3D): boolean {
  const source = emulatedSources.get(drawn);
  if (!source) return false;
  const mesh = drawn as THREE.Mesh<THREE.InstancedBufferGeometry>;
  mesh.geometry.dispose();
  mesh.geometry = emulatedPointGeometry(source.surface, groupRange(source.surface, source.group));
  return true;
}

/** Whether `drawn` draws emulated points, whose geometry is quads and no surface of its own. */
export const isEmulatedPoints = (drawn: THREE.Object3D): boolean => emulatedSources.has(drawn);

/** The corners of `surface` that `group` draws, or the whole surface for no group. */
function groupRange(surface: THREE.BufferGeometry, group: number | null): DrawRange | null {
  if (group === null) return null;
  const range = surface.groups[group];
  if (!range)
    throw new Error(`expected a draw group ${group} on the surface, found ${surface.groups.length}`);
  return range;
}
