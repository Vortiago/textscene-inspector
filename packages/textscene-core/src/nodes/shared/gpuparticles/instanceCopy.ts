/**
 * The instance buffer the copy shader fills (`particles_copy.glsl`): the settled particles in the
 * draw order, each with its basis turned for `transform_align`. Pure: no THREE and no React.
 */

import {
  affineInverseTransform3D,
  multiplyTransform3D,
  type Transform3D,
} from '../../../godot/math/transform3d';
import { GpuDrawOrder, GpuTransformAlign } from '../../../godot/scene/particles3d';
import {
  PARTICLE_FLOATS,
  readTransformColumn,
  readTransformRows,
  writeTransformColumn,
  writeTransformRows,
} from '../particles3d/particleBuffer';
import type { CameraAxes } from '../particles3d/useCameraAxes';
import { storedReal as f } from '../../../godot/math/real.js';
import { dot, normalize, scale, type Float3 } from './float3';
import { alignColumns, type AlignView, type Columns } from './instanceAlign';
import { rowsInDrawOrder } from './instanceOrder';
import type { SettledGpuParticles, TrailLayout } from './settle';

export interface InstanceCopy {
  /** `amount` of the emitter. */
  amount: number;
  drawOrder: number;
  transformAlign: number;
  localCoords: boolean;
  /** The node's global transform: the settle took a world-space particle back through it. */
  emissionTransform: Transform3D;
  /** Null until the camera is known: the order is then the index order, and no billboard turns. */
  view: CameraAxes | null;
  /** The bind pose of each trail section, which multiplies its copy. Set with a trail. */
  bindPoses?: readonly Transform3D[];
}

/** Only VIEW_DEPTH and the two billboard alignments read the camera (`particles_storage.cpp:1223`). */
export function readsCamera(drawOrder: number, transformAlign: number): boolean {
  return drawOrder === GpuDrawOrder.VIEW_DEPTH || isBillboard(transformAlign);
}

function isBillboard(transformAlign: number): boolean {
  return (
    transformAlign === GpuTransformAlign.Z_BILLBOARD ||
    transformAlign === GpuTransformAlign.Z_BILLBOARD_Y_TO_VELOCITY
  );
}

/**
 * The instance buffer for `settled`: the settled buffer itself when nothing orders, turns or skins
 * it. A trail orders whole particles and keeps each one's sections together.
 */
export function copyInstances(settled: SettledGpuParticles, request: InstanceCopy): Float32Array {
  const { trail } = settled;
  const sections = trail?.sections ?? 1;
  const frame = simulationFrame(request);
  const view = request.view && frame.view(request.view);
  // The sort key of a trail is its middle section (`particles_copy.glsl:83-86`).
  const keyRow = Math.trunc(sections / 2);
  const depth = view && depthOf(settled.buffer, frame.nodeDirection(view.direction), sections, keyRow);
  const order = rowsInDrawOrder(
    request.drawOrder,
    { phase: settled.phase, indices: settled.indices, amount: request.amount },
    depth
  );
  const turns = turnsBasis(request.transformAlign, view);
  if (!order && !turns && !trail) return settled.buffer;

  const copied = new Float32Array(settled.buffer.length);
  for (let slot = 0; slot < settled.indices.length; slot++) {
    const particle = order ? order[slot]! : slot;
    for (let section = 0; section < sections; section++) {
      const row = particle * sections + section;
      const at = (slot * sections + section) * PARTICLE_FLOATS;
      copied.set(settled.buffer.subarray(row * PARTICLE_FLOATS, (row + 1) * PARTICLE_FLOATS), at);
      const velocity = velocityAt(settled.velocity, row);
      if (trail) shiftBack(copied, at, velocity, section, trail, frame);
      if (turns) {
        turnBasis(
          copied,
          at,
          (columns) => alignColumns(request.transformAlign, columns, velocity, view),
          frame
        );
      }
      if (request.bindPoses) applyBindPose(copied, at, request.bindPoses[section]!);
    }
  }
  return copied;
}

const ORIGIN_COLUMN = 3;

/**
 * The half-step of a section: its origin goes back by `velocity * fract((k / S) * H) * (1 / fps)`,
 * because the history steps do not fit the sections exactly (`particles_copy.glsl:149-155`).
 */
function shiftBack(
  copied: Float32Array,
  at: number,
  velocity: Float3,
  section: number,
  { sections, depth, frameDelta }: TrailLayout,
  frame: SimulationFrame
): void {
  const spread = f(f(f(section / sections) * depth));
  const seconds = f(f(spread - Math.floor(spread)) * frameDelta);
  const back = frame.toNode(scale(velocity, seconds));
  const origin = readTransformColumn(copied, at, ORIGIN_COLUMN);
  writeTransformColumn(copied, at, ORIGIN_COLUMN, [
    f(origin[0] - back[0]),
    f(origin[1] - back[1]),
    f(origin[2] - back[2]),
  ]);
}

/** `txform * bind_pose` (`particles_copy.glsl:199-202`). */
function applyBindPose(copied: Float32Array, at: number, bind: Transform3D): void {
  writeTransformRows(copied, at, multiplyTransform3D(readTransformRows(copied, at), bind));
}

/** Y_TO_VELOCITY reads the velocity alone; the other turns read the camera. */
function turnsBasis(transformAlign: number, view: AlignView | null): boolean {
  if (transformAlign === GpuTransformAlign.Y_TO_VELOCITY) return true;
  return isBillboard(transformAlign) && view !== null;
}

/**
 * The position of a particle's `keyRow`-th row along `direction`, which is in node space: the order
 * of the dots is the order in the simulation space, because the node's origin shifts every particle
 * by one amount.
 */
function depthOf(
  buffer: Float32Array,
  direction: Float3,
  sections: number,
  keyRow: number
): (particle: number) => number {
  return (particle) => {
    const at = (particle * sections + keyRow) * PARTICLE_FLOATS;
    return direction[0] * buffer[at + 3]! + direction[1] * buffer[at + 7]! + direction[2] * buffer[at + 11]!;
  };
}

function velocityAt(velocity: Float32Array, row: number): Float3 {
  return [velocity[row * 3]!, velocity[row * 3 + 1]!, velocity[row * 3 + 2]!];
}

/** The space the particles simulate in, against node space. */
interface SimulationFrame {
  toSimulation(vector: Float3): Float3;
  toNode(vector: Float3): Float3;
  /** The camera axes in this space. */
  view(camera: CameraAxes): AlignView;
  /** A direction of this space as the node space holds it. */
  nodeDirection(direction: Float3): Float3;
}

const NODE_FRAME: SimulationFrame = {
  toSimulation: (vector) => vector,
  toNode: (vector) => vector,
  view: ({ axis, up }) => ({ direction: [axis.x, axis.y, axis.z], up: [up.x, up.y, up.z] }),
  nodeDirection: (direction) => direction,
};

/**
 * Local-coordinate particles sit in node space. World-space ones sit in the node's frame turned by
 * its basis, and the sort direction of a local-coordinate emitter is the world one taken into the
 * node's frame (`particles_storage.cpp:1307-1309`).
 */
function simulationFrame({ localCoords, emissionTransform }: InstanceCopy): SimulationFrame {
  if (localCoords) {
    return {
      ...NODE_FRAME,
      view: ({ axis, up }) => ({
        direction: normalize(applied(transposed(basisRows(emissionTransform)), [axis.x, axis.y, axis.z])),
        up: [up.x, up.y, up.z],
      }),
    };
  }
  const rows = basisRows(emissionTransform);
  const inverseRows = basisRows(affineInverseTransform3D(emissionTransform));
  const nodeToSimulation = transposed(rows);
  return {
    ...NODE_FRAME,
    toSimulation: (vector) => applied(rows, vector),
    toNode: (vector) => applied(inverseRows, vector),
    nodeDirection: (direction) => applied(nodeToSimulation, direction),
  };
}

/** Turns the basis of the row at `at` in `copied`, which holds node-space rows, through `align` in the simulation space. */
function turnBasis(
  copied: Float32Array,
  at: number,
  align: (columns: Columns) => void,
  frame: SimulationFrame
): void {
  const columns = [0, 1, 2].map((column) =>
    frame.toSimulation(readTransformColumn(copied, at, column))
  ) as Columns;
  align(columns);
  columns.forEach((column, index) => writeTransformColumn(copied, at, index, frame.toNode(column)));
}

function basisRows({ basis_x: x, basis_y: y, basis_z: z }: Transform3D): Float3[] {
  return [
    [x.x, x.y, x.z],
    [y.x, y.y, y.z],
    [z.x, z.y, z.z],
  ];
}

function applied(rows: Float3[], vector: Float3): Float3 {
  return [dot(rows[0]!, vector), dot(rows[1]!, vector), dot(rows[2]!, vector)];
}

function transposed(rows: Float3[]): Float3[] {
  return [0, 1, 2].map((column) => [rows[0]![column]!, rows[1]![column]!, rows[2]![column]!] as Float3);
}
